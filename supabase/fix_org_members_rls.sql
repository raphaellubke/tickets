-- Fix RLS: garantir que usuário pode ler a própria linha em organization_members
drop policy if exists "Members can view their organization's members" on public.organization_members;
drop policy if exists "Users can view their own memberships" on public.organization_members;
drop policy if exists "organization_members_select" on public.organization_members;

create policy "Users can view own memberships and org members"
  on public.organization_members for select
  using (
    user_id = auth.uid()
    or
    exists (
      select 1 from public.organization_members om2
      where om2.organization_id = organization_members.organization_id
        and om2.user_id = auth.uid()
    )
  );
