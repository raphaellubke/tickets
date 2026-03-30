-- Make user_id nullable to support pending invites
-- (invited members don't have an account yet)
alter table public.organization_members
  alter column user_id drop not null;

-- Update get_org_members RPC to also return pending (no user_id) members
create or replace function public.get_org_members(p_org_id uuid)
returns setof public.organization_members
language sql
security definer
stable
set search_path = public
as $$
  select m.*
  from public.organization_members m
  where m.organization_id = p_org_id
    and exists (
      select 1
      from public.organization_members caller
      where caller.organization_id = p_org_id
        and caller.user_id = auth.uid()
    );
$$;

-- Update RLS: "own row" policy now checks user_id (which can be null for invites)
drop policy if exists "Users see own memberships" on public.organization_members;

create policy "Users see own memberships"
  on public.organization_members for select
  using (user_id = auth.uid());

-- Allow owners/admins to delete any member (including pending invites)
drop policy if exists "Users can delete own membership" on public.organization_members;
drop policy if exists "Owners can delete members" on public.organization_members;
drop policy if exists "Members can be deleted by self or org owner/admin" on public.organization_members;

create policy "Members can be deleted by self or org owner/admin"
  on public.organization_members for delete
  using (
    user_id = auth.uid()
    or
    exists (
      select 1
      from public.organization_members caller
      where caller.organization_id = organization_members.organization_id
        and caller.user_id = auth.uid()
        and caller.role in ('owner', 'admin')
    )
  );
