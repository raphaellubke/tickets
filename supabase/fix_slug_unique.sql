-- ============================================================
-- FIX: create_organization_with_member com slug único garantido
-- Cole no Supabase SQL Editor e execute
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
  base_slug text;
  final_slug text;
  counter int := 0;
begin
  caller_id := coalesce(p_owner_id, auth.uid());

  if caller_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  -- Gera base do slug
  base_slug := coalesce(
    nullif(trim(p_org_slug), ''),
    lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]+', '-', 'g'))
  );

  -- Remove hífens no início/fim
  base_slug := trim(both '-' from base_slug);

  -- Garante slug único: tenta base_slug, depois base_slug-2, base_slug-3, etc.
  final_slug := base_slug;
  loop
    exit when not exists (
      select 1 from public.organizations where slug = final_slug
    );
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  end loop;

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
