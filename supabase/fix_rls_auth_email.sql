-- FIX COMPLETO DE RLS
-- Substitui todas as referências a auth.users por auth.email()
-- e corrige policies que bloqueavam usuários anônimos no checkout
-- Execute no Supabase SQL Editor

-- ============================================================
-- ORDERS
-- ============================================================
drop policy if exists "Org members and buyers can see orders" on public.orders;
drop policy if exists "Comprador pode ver próprio pedido por email" on public.orders;
drop policy if exists "Qualquer um pode criar pedido" on public.orders;
drop policy if exists "Sistema pode atualizar pedido" on public.orders;

create policy "Org members and buyers can see orders"
    on public.orders for select
    using (
        orders.user_id = auth.uid()
        or orders.organization_id = public.get_auth_user_org_id()
        or orders.participant_email = auth.email()
    );

create policy "Qualquer um pode criar pedido"
    on public.orders for insert
    with check (true);

create policy "Sistema pode atualizar pedido"
    on public.orders for update
    using (
        orders.user_id = auth.uid()
        or orders.organization_id = public.get_auth_user_org_id()
    );

-- ============================================================
-- ORDER_ITEMS
-- ============================================================
drop policy if exists "Org members can see order items" on public.order_items;
drop policy if exists "Pode ver itens do próprio pedido" on public.order_items;
drop policy if exists "Qualquer um pode criar item de pedido" on public.order_items;

create policy "Org members can see order items"
    on public.order_items for select
    using (
        exists (
            select 1 from public.orders o
            where o.id = order_items.order_id
              and (
                  o.user_id = auth.uid()
                  or o.organization_id = public.get_auth_user_org_id()
                  or o.participant_email = auth.email()
              )
        )
    );

create policy "Qualquer um pode criar item de pedido"
    on public.order_items for insert
    with check (true);

-- ============================================================
-- PAYMENTS
-- ============================================================
drop policy if exists "Org members and buyers can see payments" on public.payments;
drop policy if exists "Pode ver próprio pagamento" on public.payments;
drop policy if exists "Qualquer um pode criar pagamento" on public.payments;
drop policy if exists "Sistema pode atualizar pagamento" on public.payments;

create policy "Org members and buyers can see payments"
    on public.payments for select
    using (
        payments.user_id = auth.uid()
        or exists (
            select 1 from public.orders o
            where o.id = payments.order_id
              and (
                  o.organization_id = public.get_auth_user_org_id()
                  or o.user_id = auth.uid()
                  or o.participant_email = auth.email()
              )
        )
    );

create policy "Qualquer um pode criar pagamento"
    on public.payments for insert
    with check (true);

create policy "Sistema pode atualizar pagamento"
    on public.payments for update
    using (true);

-- ============================================================
-- TICKETS
-- ============================================================
drop policy if exists "Org members and buyers can see tickets" on public.tickets;
drop policy if exists "Dono do pedido pode ver ingresso" on public.tickets;
drop policy if exists "Sistema pode criar ingresso" on public.tickets;
drop policy if exists "Sistema pode atualizar ingresso" on public.tickets;

create policy "Org members and buyers can see tickets"
    on public.tickets for select
    using (
        tickets.organization_id = public.get_auth_user_org_id()
        or exists (
            select 1 from public.orders o
            where o.id = tickets.order_id
              and (
                  o.user_id = auth.uid()
                  or o.participant_email = auth.email()
              )
        )
    );

create policy "Sistema pode criar ingresso"
    on public.tickets for insert
    with check (true);

create policy "Sistema pode atualizar ingresso"
    on public.tickets for update
    using (true);

-- ============================================================
-- FORM_RESPONSES
-- ============================================================
drop policy if exists "Pode ver própria resposta de formulário" on public.form_responses;
drop policy if exists "Sistema pode criar respostas" on public.form_responses;
drop policy if exists "Pode atualizar própria resposta" on public.form_responses;

create policy "Pode ver própria resposta de formulário"
    on public.form_responses for select
    using (
        form_responses.user_id = auth.uid()
        or exists (
            select 1 from public.tickets t
            join public.orders o on o.id = t.order_id
            where t.id = form_responses.ticket_id
              and o.participant_email = auth.email()
        )
        or exists (
            select 1 from public.forms f
            join public.organization_members om on om.organization_id = f.organization_id
            where f.id = form_responses.form_id
              and om.user_id = auth.uid()
        )
    );

-- Qualquer um pode criar (checkout cria para usuários anônimos)
create policy "Sistema pode criar respostas"
    on public.form_responses for insert
    with check (true);

create policy "Pode atualizar própria resposta"
    on public.form_responses for update
    using (
        form_responses.user_id = auth.uid()
        or exists (
            select 1 from public.tickets t
            join public.orders o on o.id = t.order_id
            where t.id = form_responses.ticket_id
              and o.participant_email = auth.email()
        )
    );

-- ============================================================
-- FORM_RESPONSE_ANSWERS
-- ============================================================
drop policy if exists "Pode ver e responder próprio formulário" on public.form_response_answers;

-- SELECT: quem pode ver as respostas
create policy "Pode ver respostas do formulário"
    on public.form_response_answers for select
    using (
        exists (
            select 1 from public.form_responses fr
            where fr.id = form_response_answers.response_id
              and (
                  fr.user_id = auth.uid()
                  or exists (
                      select 1 from public.tickets t
                      join public.orders o on o.id = t.order_id
                      where t.id = fr.ticket_id
                        and o.participant_email = auth.email()
                  )
              )
        )
    );

-- INSERT: qualquer um pode criar respostas (checkout anônimo)
create policy "Pode inserir respostas do formulário"
    on public.form_response_answers for insert
    with check (true);

-- UPDATE: dono da resposta pode atualizar
create policy "Pode atualizar respostas do formulário"
    on public.form_response_answers for update
    using (
        exists (
            select 1 from public.form_responses fr
            where fr.id = form_response_answers.response_id
              and (
                  fr.user_id = auth.uid()
                  or exists (
                      select 1 from public.tickets t
                      join public.orders o on o.id = t.order_id
                      where t.id = fr.ticket_id
                        and o.participant_email = auth.email()
                  )
              )
        )
    );

-- ============================================================
-- Recarregar schema cache
-- ============================================================
notify pgrst, 'reload schema';
