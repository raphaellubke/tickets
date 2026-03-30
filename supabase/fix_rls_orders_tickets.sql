-- FIX: 403 Forbidden no dashboard para orders e tickets
--
-- Problema: as policies de orders/tickets/payments fazem subquery em
-- organization_members usando exists(...). Com a nova policy simples
-- em organization_members (user_id = auth.uid()), o contexto da avaliação
-- pode não retornar linhas corretamente para todos os casos.
--
-- Solução: substituir as subqueries pela função get_auth_user_org_id()
-- que já é SECURITY DEFINER e retorna diretamente o org_id do usuário.

-- ============================================================
-- ORDERS
-- ============================================================
drop policy if exists "Comprador pode ver próprio pedido por email" on public.orders;

create policy "Org members and buyers can see orders"
  on public.orders for select
  using (
    orders.user_id = auth.uid()
    or orders.organization_id = public.get_auth_user_org_id()
    or orders.participant_email = (select email from auth.users where id = auth.uid())
  );

-- ============================================================
-- ORDER_ITEMS
-- ============================================================
drop policy if exists "Pode ver itens do próprio pedido" on public.order_items;

create policy "Org members can see order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          o.user_id = auth.uid()
          or o.organization_id = public.get_auth_user_org_id()
          or o.participant_email = (select email from auth.users where id = auth.uid())
        )
    )
  );

-- ============================================================
-- PAYMENTS
-- ============================================================
drop policy if exists "Pode ver próprio pagamento" on public.payments;

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
        )
    )
  );

-- ============================================================
-- TICKETS
-- ============================================================
drop policy if exists "Dono do pedido pode ver ingresso" on public.tickets;

create policy "Org members and buyers can see tickets"
  on public.tickets for select
  using (
    tickets.organization_id = public.get_auth_user_org_id()
    or exists (
      select 1 from public.orders o
      where o.id = tickets.order_id
        and (
          o.user_id = auth.uid()
          or o.participant_email = (select email from auth.users where id = auth.uid())
        )
    )
  );

-- ============================================================
-- EVENTS (garantir que membros da org veem todos os eventos)
-- ============================================================
drop policy if exists "Org members can view their events" on public.events;
drop policy if exists "Anyone can view published events" on public.events;

create policy "Anyone can view published events"
  on public.events for select
  using (
    status = 'published'
    or organization_id = public.get_auth_user_org_id()
  );
