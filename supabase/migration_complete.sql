-- ============================================================
-- MIGRATION COMPLETA - Corrige todos os problemas críticos
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. CORRIGIR organization_members (adicionar campos faltantes)
-- ============================================================
alter table public.organization_members
  add column if not exists status text check (status in ('active', 'pending', 'invited')) default 'active',
  add column if not exists email text,
  add column if not exists name text,
  add column if not exists invited_by uuid references public.profiles(id) on delete set null,
  add column if not exists invited_at timestamp with time zone,
  add column if not exists joined_at timestamp with time zone;

-- Atualizar membros existentes como ativos
update public.organization_members set status = 'active' where status is null;

-- ============================================================
-- 2. CORRIGIR events (adicionar campos faltantes)
-- ============================================================
alter table public.events
  add column if not exists name text,
  add column if not exists event_date date,
  add column if not exists event_time time,
  add column if not exists cover_image_url text,
  add column if not exists max_attendees int,
  add column if not exists category text,
  add column if not exists form_id uuid,
  add column if not exists require_form boolean default false;

-- Sincronizar name com title para eventos existentes
update public.events set name = title where name is null;

-- ============================================================
-- 3. RECRIAR tickets com estrutura correta
-- ============================================================
-- Drop a tabela antiga e recriar (se existir dados, fazer backup antes)
drop table if exists public.tickets cascade;

create table public.tickets (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid,
  event_id uuid references public.events on delete cascade not null,
  ticket_type_id uuid,
  organization_id uuid references public.organizations on delete set null,
  ticket_code text unique not null,
  price decimal(10,2) default 0,
  status text check (status in ('active', 'inactive', 'cancelled')) default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 4. CRIAR event_ticket_groups
-- ============================================================
create table if not exists public.event_ticket_groups (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references public.events on delete cascade not null,
  name text not null,
  description text,
  order_index int default 0,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 5. CRIAR event_ticket_types
-- ============================================================
create table if not exists public.event_ticket_types (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references public.events on delete cascade not null,
  group_id uuid references public.event_ticket_groups on delete set null,
  name text not null,
  description text,
  price decimal(10,2) default 0,
  quantity_available int default 0,
  quantity_sold int default 0,
  is_active boolean default true,
  start_sale timestamp with time zone,
  end_sale timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 6. CRIAR orders
-- ============================================================
create table if not exists public.orders (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references public.events on delete set null,
  user_id uuid references auth.users on delete set null,
  organization_id uuid references public.organizations on delete set null,
  order_number text unique not null,
  participant_name text not null,
  participant_email text not null,
  participant_phone text,
  payment_status text check (payment_status in ('pending', 'paid', 'refunded', 'cancelled')) default 'pending',
  payment_method text check (payment_method in ('pix', 'card', 'boleto')),
  total_amount decimal(10,2) default 0,
  quantity int default 1,
  paid_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 7. CRIAR order_items
-- ============================================================
create table if not exists public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders on delete cascade not null,
  ticket_type_id uuid references public.event_ticket_types on delete set null,
  quantity int not null default 1,
  unit_price decimal(10,2) not null default 0,
  subtotal decimal(10,2) generated always as (quantity * unit_price) stored,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Adicionar FK de tickets para orders (agora que orders existe)
alter table public.tickets
  add constraint tickets_order_id_fkey foreign key (order_id) references public.orders(id) on delete set null,
  add constraint tickets_ticket_type_id_fkey foreign key (ticket_type_id) references public.event_ticket_types(id) on delete set null;

-- ============================================================
-- 8. CRIAR payments
-- ============================================================
create table if not exists public.payments (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders on delete cascade not null,
  event_id uuid references public.events on delete set null,
  user_id uuid references auth.users on delete set null,
  amount decimal(10,2) not null,
  payment_method text check (payment_method in ('pix', 'card', 'boleto')),
  payment_provider text,
  payment_provider_id text,
  status text check (status in ('processing', 'paid', 'failed', 'refunded')) default 'processing',
  paid_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 9. CORRIGIR forms e CRIAR form_fields, form_responses, form_response_answers
-- ============================================================
alter table public.forms
  add column if not exists event_id uuid references public.events on delete cascade,
  add column if not exists name text,
  add column if not exists description text;

create table if not exists public.form_fields (
  id uuid default uuid_generate_v4() primary key,
  form_id uuid references public.forms on delete cascade not null,
  label text not null,
  type text check (type in ('text', 'email', 'tel', 'date', 'textarea', 'select', 'radio', 'checkbox')) not null,
  required boolean default false,
  options jsonb,
  order_index int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.form_responses (
  id uuid default uuid_generate_v4() primary key,
  form_id uuid references public.forms on delete cascade not null,
  ticket_id uuid references public.tickets on delete cascade,
  user_id uuid references auth.users on delete set null,
  status text check (status in ('pending', 'completed')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.form_response_answers (
  id uuid default uuid_generate_v4() primary key,
  response_id uuid references public.form_responses on delete cascade not null,
  field_id uuid references public.form_fields on delete cascade not null,
  value text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 10. RPC: create_organization_with_member
-- ============================================================
create or replace function public.create_organization_with_member(
  p_org_name text,
  p_org_slug text default null,
  p_org_description text default null,
  p_owner_id uuid default null,
  p_user_email text default null,
  p_user_name text default null
) returns uuid
language plpgsql
security definer
as $$
declare
  new_org_id uuid;
  caller_id uuid;
  final_slug text;
begin
  caller_id := coalesce(p_owner_id, auth.uid());

  if caller_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  -- Gera slug automático se não fornecido
  final_slug := coalesce(
    nullif(trim(p_org_slug), ''),
    lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6)
  );

  insert into public.organizations (name, slug, description)
  values (p_org_name, final_slug, p_org_description)
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role, status, joined_at)
  values (new_org_id, caller_id, 'owner', 'active', now());

  -- Atualiza perfil do usuário se dados fornecidos
  if p_user_name is not null or p_user_email is not null then
    update public.profiles
    set
      full_name = coalesce(p_user_name, full_name),
      email     = coalesce(p_user_email, email)
    where id = caller_id;
  end if;

  return new_org_id;
end;
$$;

-- ============================================================
-- 11. RLS POLICIES para novas tabelas
-- (drop antes de criar = seguro para re-execução)
-- ============================================================

-- Garantir coluna user_id em payments (caso tabela já existia sem ela)
alter table public.payments add column if not exists user_id uuid references auth.users on delete set null;

-- orders
alter table public.orders enable row level security;
drop policy if exists "Comprador pode ver próprio pedido por email" on public.orders;
drop policy if exists "Qualquer um pode criar pedido" on public.orders;
drop policy if exists "Sistema pode atualizar pedido" on public.orders;

create policy "Comprador pode ver próprio pedido por email" on public.orders
  for select using (
    orders.participant_email = (select email from auth.users where id = auth.uid())
    or orders.user_id = auth.uid()
    or exists (
      select 1 from public.organization_members om
      where om.organization_id = orders.organization_id and om.user_id = auth.uid()
    )
  );
create policy "Qualquer um pode criar pedido" on public.orders
  for insert with check (true);
create policy "Sistema pode atualizar pedido" on public.orders
  for update using (true);

-- order_items
alter table public.order_items enable row level security;
drop policy if exists "Pode ver itens do próprio pedido" on public.order_items;
drop policy if exists "Qualquer um pode criar item de pedido" on public.order_items;

create policy "Pode ver itens do próprio pedido" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
      and (
        o.user_id = auth.uid()
        or o.participant_email = (select email from auth.users where id = auth.uid())
        or exists (
          select 1 from public.organization_members om
          where om.organization_id = o.organization_id and om.user_id = auth.uid()
        )
      )
    )
  );
create policy "Qualquer um pode criar item de pedido" on public.order_items
  for insert with check (true);

-- payments
alter table public.payments enable row level security;
drop policy if exists "Pode ver próprio pagamento" on public.payments;
drop policy if exists "Qualquer um pode criar pagamento" on public.payments;
drop policy if exists "Sistema pode atualizar pagamento" on public.payments;

create policy "Pode ver próprio pagamento" on public.payments
  for select using (
    payments.user_id = auth.uid()
    or exists (
      select 1 from public.orders o
      join public.organization_members om on om.organization_id = o.organization_id
      where o.id = payments.order_id and om.user_id = auth.uid()
    )
  );
create policy "Qualquer um pode criar pagamento" on public.payments
  for insert with check (true);
create policy "Sistema pode atualizar pagamento" on public.payments
  for update using (true);

-- tickets
alter table public.tickets enable row level security;
drop policy if exists "Dono do pedido pode ver ingresso" on public.tickets;
drop policy if exists "Sistema pode criar ingresso" on public.tickets;
drop policy if exists "Sistema pode atualizar ingresso" on public.tickets;

create policy "Dono do pedido pode ver ingresso" on public.tickets
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = tickets.order_id
      and (
        o.user_id = auth.uid()
        or o.participant_email = (select email from auth.users where id = auth.uid())
      )
    )
    or exists (
      select 1 from public.organization_members om
      where om.organization_id = tickets.organization_id and om.user_id = auth.uid()
    )
  );
create policy "Sistema pode criar ingresso" on public.tickets
  for insert with check (true);
create policy "Sistema pode atualizar ingresso" on public.tickets
  for update using (true);

-- event_ticket_groups
alter table public.event_ticket_groups enable row level security;
drop policy if exists "Qualquer um pode ver grupos de ingressos de eventos publicados" on public.event_ticket_groups;
drop policy if exists "Membros podem gerenciar grupos de ingressos" on public.event_ticket_groups;

create policy "Qualquer um pode ver grupos de ingressos de eventos publicados" on public.event_ticket_groups
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_ticket_groups.event_id
      and (e.status = 'published' or exists (
        select 1 from public.organization_members om
        where om.organization_id = e.organization_id and om.user_id = auth.uid()
      ))
    )
  );
create policy "Membros podem gerenciar grupos de ingressos" on public.event_ticket_groups
  for all using (
    exists (
      select 1 from public.events e
      join public.organization_members om on om.organization_id = e.organization_id
      where e.id = event_ticket_groups.event_id and om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'member')
    )
  );

-- event_ticket_types
alter table public.event_ticket_types enable row level security;
drop policy if exists "Qualquer um pode ver tipos de ingressos de eventos publicados" on public.event_ticket_types;
drop policy if exists "Membros podem gerenciar tipos de ingressos" on public.event_ticket_types;

create policy "Qualquer um pode ver tipos de ingressos de eventos publicados" on public.event_ticket_types
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_ticket_types.event_id
      and (e.status = 'published' or exists (
        select 1 from public.organization_members om
        where om.organization_id = e.organization_id and om.user_id = auth.uid()
      ))
    )
  );
create policy "Membros podem gerenciar tipos de ingressos" on public.event_ticket_types
  for all using (
    exists (
      select 1 from public.events e
      join public.organization_members om on om.organization_id = e.organization_id
      where e.id = event_ticket_types.event_id and om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'member')
    )
  );

-- form_fields
alter table public.form_fields enable row level security;
drop policy if exists "Qualquer um pode ver campos de formulários" on public.form_fields;
drop policy if exists "Membros podem gerenciar campos" on public.form_fields;

create policy "Qualquer um pode ver campos de formulários" on public.form_fields
  for select using (true);
create policy "Membros podem gerenciar campos" on public.form_fields
  for all using (
    exists (
      select 1 from public.forms f
      join public.organization_members om on om.organization_id = f.organization_id
      where f.id = form_fields.form_id and om.user_id = auth.uid()
    )
  );

-- form_responses
alter table public.form_responses enable row level security;
drop policy if exists "Pode ver própria resposta de formulário" on public.form_responses;
drop policy if exists "Sistema pode criar respostas" on public.form_responses;
drop policy if exists "Pode atualizar própria resposta" on public.form_responses;

create policy "Pode ver própria resposta de formulário" on public.form_responses
  for select using (
    form_responses.user_id = auth.uid()
    or exists (
      select 1 from public.tickets t
      join public.orders o on o.id = t.order_id
      where t.id = form_responses.ticket_id
      and o.participant_email = (select email from auth.users where id = auth.uid())
    )
    or exists (
      select 1 from public.forms f
      join public.organization_members om on om.organization_id = f.organization_id
      where f.id = form_responses.form_id and om.user_id = auth.uid()
    )
  );
create policy "Sistema pode criar respostas" on public.form_responses
  for insert with check (true);
create policy "Pode atualizar própria resposta" on public.form_responses
  for update using (
    form_responses.user_id = auth.uid()
    or exists (
      select 1 from public.tickets t
      join public.orders o on o.id = t.order_id
      where t.id = form_responses.ticket_id
      and o.participant_email = (select email from auth.users where id = auth.uid())
    )
  );

-- form_response_answers
alter table public.form_response_answers enable row level security;
drop policy if exists "Pode ver e responder próprio formulário" on public.form_response_answers;

create policy "Pode ver e responder próprio formulário" on public.form_response_answers
  for all using (
    exists (
      select 1 from public.form_responses fr
      where fr.id = form_response_answers.response_id
      and (
        fr.user_id = auth.uid()
        or exists (
          select 1 from public.tickets t
          join public.orders o on o.id = t.order_id
          where t.id = fr.ticket_id
          and o.participant_email = (select email from auth.users where id = auth.uid())
        )
      )
    )
  );

-- organizations
drop policy if exists "Members can view their organizations" on public.organizations;
drop policy if exists "Members can create organizations" on public.organizations;
drop policy if exists "Owners can update organizations" on public.organizations;

create policy "Members can view their organizations" on public.organizations
  for select using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = organizations.id
      and om.user_id = auth.uid()
      and om.status = 'active'
    )
  );
create policy "Members can create organizations" on public.organizations
  for insert with check (auth.uid() is not null);
create policy "Owners can update organizations" on public.organizations
  for update using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = organizations.id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
      and om.status = 'active'
    )
  );

-- organization_members
drop policy if exists "Members can view org members" on public.organization_members;
drop policy if exists "Owners/admins can manage members" on public.organization_members;
drop policy if exists "Owners/admins can update members" on public.organization_members;

create policy "Members can view org members" on public.organization_members
  for select using (
    organization_members.user_id = auth.uid()
    or exists (
      select 1 from public.organization_members om2
      where om2.organization_id = organization_members.organization_id
      and om2.user_id = auth.uid()
      and om2.status = 'active'
    )
  );
create policy "Owners/admins can manage members" on public.organization_members
  for insert with check (
    exists (
      select 1 from public.organization_members om2
      where om2.organization_id = organization_members.organization_id
      and om2.user_id = auth.uid()
      and om2.role in ('owner', 'admin')
      and om2.status = 'active'
    )
    or not exists (
      select 1 from public.organization_members om3
      where om3.organization_id = organization_members.organization_id
    )
  );
create policy "Owners/admins can update members" on public.organization_members
  for update using (
    organization_members.user_id = auth.uid()
    or exists (
      select 1 from public.organization_members om2
      where om2.organization_id = organization_members.organization_id
      and om2.user_id = auth.uid()
      and om2.role in ('owner', 'admin')
      and om2.status = 'active'
    )
  );

-- events
drop policy if exists "Members can create events" on public.events;
drop policy if exists "Members can update events" on public.events;

create policy "Members can create events" on public.events
  for insert with check (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = events.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'member')
      and om.status = 'active'
    )
  );
create policy "Members can update events" on public.events
  for update using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = events.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'member')
      and om.status = 'active'
    )
  );
