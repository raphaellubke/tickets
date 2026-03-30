-- ============================================================
-- FIX v3: Remove TODA recursão de organization_members
--
-- Causa raiz: qualquer policy SELECT em organization_members que
-- faz subquery na mesma tabela → PostgreSQL detecta recursão infinita.
-- Isso ocorre mesmo com SECURITY DEFINER functions.
--
-- Solução: policy simples SEM auto-referência + função RPC para
-- casos que precisam ver membros de outros usuários da org.
-- ============================================================

-- Step 1: Dropar TODAS as policies existentes na tabela
-- (incluindo qualquer uma que não sabemos o nome)
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'organization_members'
  loop
    execute format(
      'drop policy if exists %I on public.organization_members',
      pol.policyname
    );
  end loop;
end $$;

-- Step 2: Policy simples e não-recursiva
-- Usuário só vê as próprias linhas (sem subquery na mesma tabela)
create policy "Users see own memberships"
  on public.organization_members for select
  using (user_id = auth.uid());

-- Step 3: Função SECURITY DEFINER para buscar todos os membros de uma org
-- Usada pela página de Membros (que precisa ver todos, não só o próprio)
-- Verifica internamente se o chamador é membro antes de retornar dados.
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
    -- Só retorna se o usuário autenticado for membro dessa org
    and exists (
      select 1
      from public.organization_members caller
      where caller.organization_id = p_org_id
        and caller.user_id = auth.uid()
    );
$$;

-- Step 4: Garantir que INSERT/UPDATE/DELETE também têm policies corretas
-- (necessário para o fluxo de convite de membros)
drop policy if exists "Users can insert org members" on public.organization_members;
drop policy if exists "Owners can insert members" on public.organization_members;
drop policy if exists "Owners can update members" on public.organization_members;
drop policy if exists "Owners can delete members" on public.organization_members;

create policy "Authenticated users can insert members"
  on public.organization_members for insert
  with check (true);  -- controle feito no código/RPC

create policy "Users can update own membership"
  on public.organization_members for update
  using (user_id = auth.uid());

create policy "Users can delete own membership"
  on public.organization_members for delete
  using (user_id = auth.uid());
