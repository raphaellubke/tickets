-- ============================================================
-- Waitlist Entries + Coupons
-- ============================================================

-- 1. WAITLIST ENTRIES
-- ============================================================
create table if not exists public.waitlist_entries (
    id              uuid primary key default gen_random_uuid(),
    event_id        uuid not null references public.events(id) on delete cascade,
    ticket_type_id  uuid references public.event_ticket_types(id) on delete set null,
    organization_id uuid references public.organizations(id) on delete cascade,
    name            text not null,
    email           text not null,
    phone           text,
    position        integer,
    status          text not null default 'waiting'
                        check (status in ('waiting', 'notified', 'converted', 'expired')),
    notes           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

alter table public.waitlist_entries enable row level security;

-- Public can insert (non-authenticated users on event page)
create policy "Public can join waitlist"
    on public.waitlist_entries for insert
    with check (true);

-- Org members can view/manage their event's waitlist
create policy "Org members can view waitlist"
    on public.waitlist_entries for select
    using (organization_id = public.get_auth_user_org_id());

create policy "Org members can update waitlist"
    on public.waitlist_entries for update
    using (organization_id = public.get_auth_user_org_id());

create policy "Org members can delete waitlist"
    on public.waitlist_entries for delete
    using (organization_id = public.get_auth_user_org_id());

-- RPC: add to waitlist with auto-position and duplicate check
create or replace function public.add_to_waitlist(
    p_event_id        uuid,
    p_organization_id uuid,
    p_name            text,
    p_email           text,
    p_phone           text default null,
    p_ticket_type_id  uuid default null
)
returns public.waitlist_entries
language plpgsql
security definer
set search_path = public
as $$
declare
    v_position integer;
    v_entry    public.waitlist_entries;
begin
    -- check if already on waitlist for this event
    if exists (
        select 1 from public.waitlist_entries
        where event_id = p_event_id
          and lower(email) = lower(p_email)
          and status = 'waiting'
    ) then
        raise exception 'Este e-mail já está na lista de espera deste evento';
    end if;

    -- get next position
    select coalesce(max(position), 0) + 1
    into v_position
    from public.waitlist_entries
    where event_id = p_event_id
      and status = 'waiting';

    insert into public.waitlist_entries (
        event_id, ticket_type_id, organization_id,
        name, email, phone, position, status
    ) values (
        p_event_id, p_ticket_type_id, p_organization_id,
        p_name, p_email, p_phone, v_position, 'waiting'
    )
    returning * into v_entry;

    return v_entry;
end;
$$;


-- 2. COUPONS
-- ============================================================
create table if not exists public.coupons (
    id               uuid primary key default gen_random_uuid(),
    organization_id  uuid not null references public.organizations(id) on delete cascade,
    event_id         uuid references public.events(id) on delete cascade,
    code             text not null,
    description      text,
    discount_type    text not null check (discount_type in ('percentage', 'fixed')),
    discount_value   numeric(10,2) not null check (discount_value > 0),
    max_uses         integer,
    uses_count       integer not null default 0,
    min_order_amount numeric(10,2),
    valid_from       timestamptz,
    valid_until      timestamptz,
    is_active        boolean not null default true,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    unique (organization_id, code)
);

alter table public.coupons enable row level security;

-- Org members can do everything with their coupons
create policy "Org members can manage coupons"
    on public.coupons for all
    using (organization_id = public.get_auth_user_org_id())
    with check (organization_id = public.get_auth_user_org_id());

-- 3. ADD COUPON FIELDS TO ORDERS
-- ============================================================
alter table public.orders
    add column if not exists coupon_id       uuid references public.coupons(id),
    add column if not exists discount_amount numeric(10,2) not null default 0;

-- 4. RPC: validate coupon
-- ============================================================
create or replace function public.validate_coupon(
    p_code             text,
    p_organization_id  uuid,
    p_event_id         uuid    default null,
    p_order_amount     numeric default 0
)
returns table (
    id             uuid,
    code           text,
    description    text,
    discount_type  text,
    discount_value numeric,
    discount_amount numeric,
    is_valid       boolean,
    error_message  text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_coupon public.coupons;
    v_discount numeric;
begin
    -- find coupon (case-insensitive)
    select * into v_coupon
    from public.coupons c
    where upper(c.code) = upper(p_code)
      and c.organization_id = p_organization_id
      and c.is_active = true
    limit 1;

    if not found then
        return query select
            null::uuid, p_code, null::text, null::text,
            null::numeric, 0::numeric, false,
            'Cupom não encontrado ou inativo'::text;
        return;
    end if;

    -- check event restriction
    if v_coupon.event_id is not null
       and (p_event_id is null or v_coupon.event_id != p_event_id) then
        return query select
            v_coupon.id, v_coupon.code, v_coupon.description,
            v_coupon.discount_type, v_coupon.discount_value,
            0::numeric, false, 'Cupom não válido para este evento'::text;
        return;
    end if;

    -- check max uses
    if v_coupon.max_uses is not null
       and v_coupon.uses_count >= v_coupon.max_uses then
        return query select
            v_coupon.id, v_coupon.code, v_coupon.description,
            v_coupon.discount_type, v_coupon.discount_value,
            0::numeric, false, 'Limite de usos do cupom atingido'::text;
        return;
    end if;

    -- check valid_from
    if v_coupon.valid_from is not null and now() < v_coupon.valid_from then
        return query select
            v_coupon.id, v_coupon.code, v_coupon.description,
            v_coupon.discount_type, v_coupon.discount_value,
            0::numeric, false, 'Cupom ainda não está ativo'::text;
        return;
    end if;

    -- check valid_until
    if v_coupon.valid_until is not null and now() > v_coupon.valid_until then
        return query select
            v_coupon.id, v_coupon.code, v_coupon.description,
            v_coupon.discount_type, v_coupon.discount_value,
            0::numeric, false, 'Cupom expirado'::text;
        return;
    end if;

    -- check min order amount
    if v_coupon.min_order_amount is not null
       and p_order_amount < v_coupon.min_order_amount then
        return query select
            v_coupon.id, v_coupon.code, v_coupon.description,
            v_coupon.discount_type, v_coupon.discount_value,
            0::numeric, false,
            ('Valor mínimo para usar este cupom: R$ '
             || to_char(v_coupon.min_order_amount, 'FM999999990D00'))::text;
        return;
    end if;

    -- calculate discount
    if v_coupon.discount_type = 'percentage' then
        v_discount := round((p_order_amount * v_coupon.discount_value / 100)::numeric, 2);
    else
        v_discount := least(v_coupon.discount_value, p_order_amount);
    end if;

    return query select
        v_coupon.id, v_coupon.code, v_coupon.description,
        v_coupon.discount_type, v_coupon.discount_value,
        v_discount, true, null::text;
end;
$$;

-- 5. RPC: increment coupon uses (atomic, avoids race condition)
-- ============================================================
create or replace function public.increment_coupon_uses(p_coupon_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
    update public.coupons
    set uses_count = uses_count + 1,
        updated_at = now()
    where id = p_coupon_id;
$$;
