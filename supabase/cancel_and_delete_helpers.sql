-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers para cancelamento automático e exclusão de pedidos
-- Execute este script no Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Cancela pedidos pendentes expirados (mais de 12 minutos sem pagamento)
CREATE OR REPLACE FUNCTION public.cancel_expired_orders(p_event_id UUID DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE public.orders
    SET payment_status = 'cancelled'
    WHERE payment_status = 'pending'
      AND created_at < NOW() - INTERVAL '12 minutes'
      AND (p_event_id IS NULL OR event_id = p_event_id);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- 2. Exclui pedido e todos os dados relacionados em cascata
CREATE OR REPLACE FUNCTION public.delete_order_cascade(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket_ids    UUID[];
    v_response_ids  UUID[];
    v_was_paid      BOOLEAN;
BEGIN
    -- Verifica se o pedido estava pago (para restaurar quantity_sold)
    SELECT payment_status = 'paid' INTO v_was_paid
    FROM public.orders WHERE id = p_order_id;

    -- Restaura quantity_sold nos tipos de ingresso (apenas para pedidos pagos)
    IF v_was_paid THEN
        UPDATE public.event_ticket_types ett
        SET quantity_sold = GREATEST(0, ett.quantity_sold - oi.quantity)
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id
          AND oi.ticket_type_id = ett.id;
    END IF;

    -- Busca IDs dos ingressos
    SELECT ARRAY_AGG(id) INTO v_ticket_ids
    FROM public.tickets WHERE order_id = p_order_id;

    IF v_ticket_ids IS NOT NULL THEN
        -- Busca IDs das respostas de formulário
        SELECT ARRAY_AGG(id) INTO v_response_ids
        FROM public.form_responses WHERE ticket_id = ANY(v_ticket_ids);

        IF v_response_ids IS NOT NULL THEN
            DELETE FROM public.form_response_answers WHERE response_id = ANY(v_response_ids);
            DELETE FROM public.form_responses WHERE id = ANY(v_response_ids);
        END IF;

        DELETE FROM public.tickets WHERE id = ANY(v_ticket_ids);
    END IF;

    -- Exclui pagamentos, itens do pedido e o pedido em si
    DELETE FROM public.payments   WHERE order_id = p_order_id;
    DELETE FROM public.order_items WHERE order_id = p_order_id;
    DELETE FROM public.orders      WHERE id = p_order_id;
END;
$$;

-- Grants para funções autenticadas chamarem via RPC
GRANT EXECUTE ON FUNCTION public.cancel_expired_orders(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_order_cascade(UUID)  TO service_role;
