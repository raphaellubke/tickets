-- Function to create an organization and add the creator as owner
create or replace function create_organization(
  org_name text,
  org_slug text,
  org_description text,
  org_website text,
  org_phone text,
  org_owner_id uuid
) returns uuid
language plpgsql
security definer
as $$
declare
  new_org_id uuid;
begin
  -- Insert Organization
  insert into public.organizations (name, slug, description, website, phone)
  values (org_name, org_slug, org_description, org_website, org_phone)
  returning id into new_org_id;

  -- Insert Member (Owner)
  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, org_owner_id, 'owner');

  return new_org_id;
end;
$$;
