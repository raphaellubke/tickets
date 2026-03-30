-- FIX: Infinite recursion in organization_members RLS policy
--
-- The problem: the SELECT policy references organization_members via a subquery,
-- which triggers the same policy again → infinite loop (error 42P17).
--
-- The fix: use a SECURITY DEFINER function that bypasses RLS to get the user's
-- organization_id, then use that in a non-recursive policy.

-- Step 1: Create a helper function that runs as superuser (bypasses RLS)
create or replace function public.get_auth_user_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid()
  limit 1;
$$;

-- Step 2: Drop the broken recursive policy
drop policy if exists "Users can view own memberships and org members" on public.organization_members;
drop policy if exists "Members can view their organization's members" on public.organization_members;
drop policy if exists "Users can view their own memberships" on public.organization_members;
drop policy if exists "organization_members_select" on public.organization_members;

-- Step 3: Create a non-recursive policy using the helper function
create policy "Users can view org members"
  on public.organization_members for select
  using (
    user_id = auth.uid()
    or organization_id = public.get_auth_user_org_id()
  );
