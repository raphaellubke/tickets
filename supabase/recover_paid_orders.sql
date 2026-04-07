-- ============================================================
-- RECUPERAÇÃO DE PEDIDOS PAGOS CANCELADOS INDEVIDAMENTE
-- Execute no Supabase SQL Editor
-- ============================================================

-- PASSO 1: Confirme os pedidos antes de alterar qualquer coisa
SELECT
    o.order_number,
    o.participant_name,
    o.participant_email,
    o.payment_status,
    o.total_amount,
    p.status            AS status_pagamento,
    p.payment_provider_id AS id_mp,
    COUNT(t.id)         AS tickets_existentes
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id
LEFT JOIN tickets  t ON t.order_id = o.id
WHERE o.order_number IN (
    'ORD-1775408609962-RCLGETICJ',
    'ORD-1775338776096-U1M9M2TX2',
    'ORD-1775306426545-FLY8OEWK6',
    'ORD-1775302797548-UORISLN8K',
    'ORD-1775302671861-JEE7VPJL5',
    'ORD-1775302050083-PEUSYZ6JN',
    'ORD-1775297177472-4HV1PW5A4'
)
GROUP BY o.order_number, o.participant_name, o.participant_email,
         o.payment_status, o.total_amount, p.status, p.payment_provider_id
ORDER BY o.order_number;


-- ============================================================
-- PASSO 2: Recuperação completa (rode após confirmar o passo 1)
-- Atualiza status + cria tickets + form_responses
-- ============================================================

DO $$
DECLARE
    v_order_numbers TEXT[] := ARRAY[
        'ORD-1775408609962-RCLGETICJ',
        'ORD-1775338776096-U1M9M2TX2',
        'ORD-1775306426545-FLY8OEWK6',
        'ORD-1775302797548-UORISLN8K',
        'ORD-1775302671861-JEE7VPJL5',
        'ORD-1775302050083-PEUSYZ6JN',
        'ORD-1775297177472-4HV1PW5A4'
    ];
    v_order_number    TEXT;
    v_order           RECORD;
    v_item            RECORD;
    v_form_id         UUID;
    v_form_fields     UUID[];
    v_field_id        UUID;
    v_ticket_code     TEXT;
    v_ticket_id       UUID;
    v_response_id     UUID;
    i                 INT;
    v_tickets_exist   INT;
BEGIN
    FOREACH v_order_number IN ARRAY v_order_numbers LOOP

        -- Busca o pedido
        SELECT * INTO v_order FROM public.orders WHERE order_number = v_order_number;

        IF NOT FOUND THEN
            RAISE NOTICE '[SKIP] Pedido não encontrado: %', v_order_number;
            CONTINUE;
        END IF;

        -- 1. Atualiza status do pedido
        UPDATE public.orders
        SET payment_status = 'paid',
            paid_at        = NOW(),
            updated_at     = NOW()
        WHERE id = v_order.id;

        -- 2. Atualiza registro de pagamento
        UPDATE public.payments
        SET status     = 'paid',
            paid_at    = NOW(),
            updated_at = NOW()
        WHERE order_id = v_order.id
          AND status != 'paid';

        -- 3. Verifica se tickets já foram criados (idempotência)
        SELECT COUNT(*) INTO v_tickets_exist
        FROM public.tickets WHERE order_id = v_order.id;

        IF v_tickets_exist > 0 THEN
            RAISE NOTICE '[OK] Pedido % já tem % ticket(s), pulando criação', v_order_number, v_tickets_exist;
            CONTINUE;
        END IF;

        -- 4. Busca form_id do evento
        v_form_id := NULL;
        SELECT form_id INTO v_form_id FROM public.events WHERE id = v_order.event_id;

        -- 5. Busca campos do formulário
        v_form_fields := NULL;
        IF v_form_id IS NOT NULL THEN
            SELECT ARRAY_AGG(id ORDER BY order_index)
            INTO v_form_fields
            FROM public.form_fields
            WHERE form_id = v_form_id;
        END IF;

        -- 6. Cria tickets para cada item do pedido
        FOR v_item IN
            SELECT * FROM public.order_items WHERE order_id = v_order.id
        LOOP
            FOR i IN 1..v_item.quantity LOOP

                -- Gera código único de ingresso
                v_ticket_code := 'TKT-' ||
                    (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT ||
                    '-' ||
                    UPPER(SUBSTRING(MD5(RANDOM()::TEXT || i::TEXT || v_item.id::TEXT), 1, 9));

                -- Insere o ticket
                INSERT INTO public.tickets (
                    order_id, event_id, ticket_type_id,
                    ticket_code, status, organization_id
                )
                VALUES (
                    v_order.id, v_order.event_id, v_item.ticket_type_id,
                    v_ticket_code, 'active', v_order.organization_id
                )
                RETURNING id INTO v_ticket_id;

                -- Atualiza quantity_sold no tipo de ingresso
                PERFORM public.increment_quantity_sold(v_item.ticket_type_id);

                -- Cria form_response se o evento tem formulário
                IF v_form_id IS NOT NULL THEN
                    INSERT INTO public.form_responses (form_id, ticket_id, user_id, status)
                    VALUES (v_form_id, v_ticket_id, v_order.user_id, 'pending')
                    RETURNING id INTO v_response_id;

                    IF v_form_fields IS NOT NULL THEN
                        FOREACH v_field_id IN ARRAY v_form_fields LOOP
                            INSERT INTO public.form_response_answers (response_id, field_id, value)
                            VALUES (v_response_id, v_field_id, NULL);
                        END LOOP;
                    END IF;
                END IF;

                RAISE NOTICE '[TICKET] % criado para % (%)', v_ticket_code, v_order.participant_name, v_order_number;

            END LOOP;
        END LOOP;

        RAISE NOTICE '[DONE] Pedido recuperado: % — %', v_order_number, v_order.participant_name;

    END LOOP;

    RAISE NOTICE '=== Recuperação concluída ===';
END $$;


-- ============================================================
-- PASSO 3: Confirme o resultado após o DO block acima
-- ============================================================
SELECT
    o.order_number,
    o.participant_name,
    o.participant_email,
    o.payment_status,
    COUNT(t.id) AS tickets_criados
FROM public.orders o
LEFT JOIN public.tickets t ON t.order_id = o.id
WHERE o.order_number IN (
    'ORD-1775408609962-RCLGETICJ',
    'ORD-1775338776096-U1M9M2TX2',
    'ORD-1775306426545-FLY8OEWK6',
    'ORD-1775302797548-UORISLN8K',
    'ORD-1775302671861-JEE7VPJL5',
    'ORD-1775302050083-PEUSYZ6JN',
    'ORD-1775297177472-4HV1PW5A4'
)
GROUP BY o.order_number, o.participant_name, o.participant_email, o.payment_status
ORDER BY o.order_number;
