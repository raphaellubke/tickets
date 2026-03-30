-- Allow owners/admins to remove other members from their organization
-- (replaces the "own row only" delete policy)

drop policy if exists "Users can delete own membership" on public.organization_members;
drop policy if exists "Owners can delete members" on public.organization_members;

create policy "Members can be deleted by self or org owner/admin"
  on public.organization_members for delete
  using (
    -- Can always delete your own membership
    user_id = auth.uid()
    or
    -- Org owners and admins can remove others
    exists (
      select 1
      from public.organization_members caller
      where caller.organization_id = organization_members.organization_id
        and caller.user_id = auth.uid()
        and caller.role in ('owner', 'admin')
    )
  );
