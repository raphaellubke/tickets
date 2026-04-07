-- ============================================================
-- DIAGNÓSTICO E RECUPERAÇÃO DE PEDIDOS CANCELADOS INDEVIDAMENTE
-- Execute cada bloco separadamente no Supabase SQL Editor
-- ============================================================

-- PASSO 1: Ver todos os pedidos cancelados com pagamento no MP
-- (para confirmar quais têm payment_provider_id e qual o status no nosso banco)
SELECT
    o.order_number,
    o.participant_name,
    o.participant_email,
    o.payment_status,
    o.total_amount,
    o.created_at,
    o.updated_at,
    p.status              AS status_pagamento,
    p.payment_method,
    p.payment_provider_id AS id_no_mercadopago,
    p.paid_at
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id
WHERE o.payment_status = 'cancelled'
  AND p.payment_provider_id IS NOT NULL
ORDER BY o.created_at DESC;


-- ============================================================
-- PASSO 2: Após rodar check_mp_payments.js e identificar os aprovados,
-- substitua os order_numbers abaixo e execute para confirmar antes de alterar
-- ============================================================
-- SELECT id, order_number, participant_name, participant_email, payment_status, total_amount
-- FROM orders
-- WHERE order_number IN (
--     'ORD-XXXX',
--     'ORD-YYYY'
-- );


-- ============================================================
-- PASSO 3: Marcar pedidos como pagos (só rode após confirmar no MP)
-- ============================================================
-- UPDATE orders
-- SET
--     payment_status = 'paid',
--     paid_at        = NOW(),
--     updated_at     = NOW()
-- WHERE order_number IN (
--     'ORD-XXXX',
--     'ORD-YYYY'
-- )
-- AND payment_status = 'cancelled';


-- ============================================================
-- PASSO 4: Atualizar registros de pagamento
-- ============================================================
-- UPDATE payments p
-- SET
--     status     = 'paid',
--     paid_at    = NOW(),
--     updated_at = NOW()
-- FROM orders o
-- WHERE p.order_id = o.id
--   AND o.order_number IN (
--     'ORD-XXXX',
--     'ORD-YYYY'
--   )
--   AND p.status != 'paid';


-- ============================================================
-- PASSO 5: Verificar se tickets já foram criados para os pedidos recuperados
-- (se não existirem, será necessário criar via recover_tickets.js)
-- ============================================================
-- SELECT
--     o.order_number,
--     o.participant_name,
--     o.payment_status,
--     COUNT(t.id) AS qtd_tickets
-- FROM orders o
-- LEFT JOIN tickets t ON t.order_id = o.id
-- WHERE o.order_number IN (
--     'ORD-XXXX',
--     'ORD-YYYY'
-- )
-- GROUP BY o.order_number, o.participant_name, o.payment_status;


-- ============================================================
-- DIAGNÓSTICO EXTRA: pedidos sem tickets apesar de estarem pagos
-- (útil para encontrar outros casos além dos 23 cancelados)
-- ============================================================
SELECT
    o.order_number,
    o.participant_name,
    o.participant_email,
    o.payment_status,
    o.total_amount,
    o.created_at,
    COUNT(t.id) AS qtd_tickets
FROM orders o
LEFT JOIN tickets t ON t.order_id = o.id
WHERE o.payment_status = 'paid'
GROUP BY o.id, o.order_number, o.participant_name, o.participant_email,
         o.payment_status, o.total_amount, o.created_at
HAVING COUNT(t.id) = 0
ORDER BY o.created_at DESC;
