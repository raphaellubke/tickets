-- Políticas RLS para a tabela forms
-- Membros da organização podem criar, ver, editar e deletar seus formulários

drop policy if exists "Org members can select forms" on public.forms;
drop policy if exists "Org members can insert forms" on public.forms;
drop policy if exists "Org members can update forms" on public.forms;
drop policy if exists "Org members can delete forms" on public.forms;

create policy "Org members can select forms"
    on public.forms for select
    using (
        organization_id = public.get_auth_user_org_id()
    );

create policy "Org members can insert forms"
    on public.forms for insert
    with check (
        organization_id = public.get_auth_user_org_id()
    );

create policy "Org members can update forms"
    on public.forms for update
    using (
        organization_id = public.get_auth_user_org_id()
    );

create policy "Org members can delete forms"
    on public.forms for delete
    using (
        organization_id = public.get_auth_user_org_id()
    );
