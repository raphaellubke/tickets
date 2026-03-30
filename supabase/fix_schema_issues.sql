-- Fix 1: Add updated_at to organizations (org page tries to save it)
alter table public.organizations
  add column if not exists updated_at timestamp with time zone;

-- Fix 2: Add 'organizer' role to organization_members constraint
-- (InviteMemberModal offers this role but DB constraint blocks it)
alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add constraint organization_members_role_check
    check (role in ('owner', 'admin', 'organizer', 'member', 'viewer'));

-- Fix 3: Atomic quantity_sold increment (avoids race condition with concurrent orders)
create or replace function increment_quantity_sold(p_ticket_type_id uuid)
returns void
language sql
security definer
as $$
  update public.event_ticket_types
  set quantity_sold = coalesce(quantity_sold, 0) + 1
  where id = p_ticket_type_id;
$$;

-- Fix 4: Add 'used' to ticket status constraint
-- (tickets can be scanned/checked-in at the event)
alter table public.tickets
  drop constraint if exists tickets_status_check;

alter table public.tickets
  add constraint tickets_status_check
    check (status in ('active', 'used', 'cancelled', 'inactive'));
