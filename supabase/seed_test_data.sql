-- ============================================================
-- SEED DE DADOS DE TESTE
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor)
-- Cria: evento, formulário, cupom, 2 participantes pagos
--       (1 com form preenchido, 1 pendente) + lista de espera
-- ============================================================

DO $$
DECLARE
    v_org_id        uuid;
    v_event_id      uuid;
    v_group_id      uuid;
    v_type_id       uuid;
    v_form_id       uuid;
    v_field_name    uuid;
    v_field_phone   uuid;
    v_field_cpf     uuid;
    v_field_shirt   uuid;
    v_coupon_id     uuid;
    v_order_id      uuid;
    v_order_id2     uuid;
    v_ticket_id     uuid;
    v_ticket_id2    uuid;
    v_response_id   uuid;
    v_response_id2  uuid;
    v_today         text;
BEGIN

v_today := to_char(now(), 'YYYYMMDD');

-- ── 1. Pegar a primeira organização existente ───────────────
SELECT id INTO v_org_id
FROM public.organizations
LIMIT 1;

IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma organização encontrada. Crie uma organização primeiro no dashboard.';
END IF;

RAISE NOTICE 'Usando organização: %', v_org_id;

-- ── 2. Criar o Evento ───────────────────────────────────────
INSERT INTO public.events (
    organization_id,
    title,
    name,
    description,
    event_date,
    event_time,
    location,
    status,
    allow_waitlist,
    require_form
) VALUES (
    v_org_id,
    'Festival Tech 2025',
    'Festival Tech 2025',
    'O maior festival de tecnologia do ano, com palestras, workshops e networking.',
    '2025-11-15',
    '09:00',
    'Centro de Convenções São Paulo – SP',
    'published',
    true,
    true
)
RETURNING id INTO v_event_id;

RAISE NOTICE 'Evento criado: %', v_event_id;

-- ── 3. Criar Grupo de Ingressos ─────────────────────────────
INSERT INTO public.event_ticket_groups (
    event_id,
    organization_id,
    name,
    description,
    order_index,
    is_active
) VALUES (
    v_event_id,
    v_org_id,
    'Ingressos Gerais',
    'Acesso completo ao evento',
    0,
    true
)
RETURNING id INTO v_group_id;

-- ── 4. Criar Tipo de Ingresso ───────────────────────────────
INSERT INTO public.event_ticket_types (
    event_id,
    group_id,
    organization_id,
    name,
    description,
    price,
    quantity_available,
    quantity_sold,
    is_active
) VALUES (
    v_event_id,
    v_group_id,
    v_org_id,
    'Ingresso Inteira',
    'Acesso completo ao evento',
    149.90,
    200,
    2,
    true
)
RETURNING id INTO v_type_id;

RAISE NOTICE 'Tipo de ingresso criado: %', v_type_id;

-- ── 5. Criar Formulário com Campos ─────────────────────────
INSERT INTO public.forms (
    organization_id,
    event_id,
    name,
    description,
    status
) VALUES (
    v_org_id,
    v_event_id,
    'Formulário do Participante',
    'Preencha seus dados para confirmar a participação',
    'active'
)
RETURNING id INTO v_form_id;

INSERT INTO public.form_fields (form_id, label, type, required, order_index)
VALUES (v_form_id, 'Nome completo', 'text', true, 0)
RETURNING id INTO v_field_name;

INSERT INTO public.form_fields (form_id, label, type, required, order_index)
VALUES (v_form_id, 'Telefone celular', 'tel', true, 1)
RETURNING id INTO v_field_phone;

INSERT INTO public.form_fields (form_id, label, type, required, order_index)
VALUES (v_form_id, 'CPF', 'text', true, 2)
RETURNING id INTO v_field_cpf;

INSERT INTO public.form_fields (form_id, label, type, required, options, order_index)
VALUES (v_form_id, 'Tamanho da camiseta', 'select', false, '["PP","P","M","G","GG","XG"]'::jsonb, 3)
RETURNING id INTO v_field_shirt;

RAISE NOTICE 'Formulário criado: %', v_form_id;

-- Vincular formulário ao evento
UPDATE public.events
SET form_id = v_form_id, require_form = true
WHERE id = v_event_id;

-- ── 6. Criar Cupom ──────────────────────────────────────────
INSERT INTO public.coupons (
    organization_id,
    event_id,
    code,
    description,
    discount_type,
    discount_value,
    max_uses,
    uses_count,
    min_order_amount,
    is_active
) VALUES (
    v_org_id,
    v_event_id,
    'TESTE10',
    'Desconto de 10% para testes',
    'percentage',
    10.00,
    100,
    0,
    50.00,
    true
)
RETURNING id INTO v_coupon_id;

RAISE NOTICE 'Cupom criado: TESTE10';

-- ── 7. Participante 1: Pago + Formulário PREENCHIDO ─────────
INSERT INTO public.orders (
    event_id, organization_id,
    order_number,
    participant_name, participant_email,
    payment_status, payment_method,
    total_amount, quantity, paid_at
) VALUES (
    v_event_id, v_org_id,
    'ORD-TEST-' || v_today || '-001',
    'João Silva Teste', 'joao.teste@exemplo.com',
    'paid', 'pix',
    149.90, 1, now() - interval '2 hours'
)
RETURNING id INTO v_order_id;

INSERT INTO public.tickets (
    order_id, event_id, ticket_type_id, organization_id,
    ticket_code, price, status
) VALUES (
    v_order_id, v_event_id, v_type_id, v_org_id,
    'TKT-TEST-' || upper(substr(gen_random_uuid()::text, 1, 8)),
    149.90, 'active'
)
RETURNING id INTO v_ticket_id;

INSERT INTO public.form_responses (form_id, ticket_id, status)
VALUES (v_form_id, v_ticket_id, 'completed')
RETURNING id INTO v_response_id;

INSERT INTO public.form_response_answers (response_id, field_id, value)
VALUES
    (v_response_id, v_field_name,  'João Silva Teste'),
    (v_response_id, v_field_phone, '(11) 99999-0001'),
    (v_response_id, v_field_cpf,   '123.456.789-00'),
    (v_response_id, v_field_shirt, 'G');

RAISE NOTICE 'Participante 1 criado: João Silva (pago + form preenchido)';

-- ── 8. Participante 2: Pago + Formulário PENDENTE ───────────
INSERT INTO public.orders (
    event_id, organization_id,
    order_number,
    participant_name, participant_email,
    payment_status, payment_method,
    total_amount, quantity, paid_at
) VALUES (
    v_event_id, v_org_id,
    'ORD-TEST-' || v_today || '-002',
    'Maria Santos Teste', 'maria.teste@exemplo.com',
    'paid', 'card',
    149.90, 1, now() - interval '1 hour'
)
RETURNING id INTO v_order_id2;

INSERT INTO public.tickets (
    order_id, event_id, ticket_type_id, organization_id,
    ticket_code, price, status
) VALUES (
    v_order_id2, v_event_id, v_type_id, v_org_id,
    'TKT-TEST-' || upper(substr(gen_random_uuid()::text, 1, 8)),
    149.90, 'active'
)
RETURNING id INTO v_ticket_id2;

INSERT INTO public.form_responses (form_id, ticket_id, status)
VALUES (v_form_id, v_ticket_id2, 'pending')
RETURNING id INTO v_response_id2;

RAISE NOTICE 'Participante 2 criado: Maria Santos (pago + form pendente)';

-- ── 9. Entrada na lista de espera ────────────────────────────
INSERT INTO public.waitlist_entries (
    event_id, organization_id,
    name, email, phone,
    position, status
) VALUES (
    v_event_id, v_org_id,
    'Carlos Espera', 'carlos.espera@exemplo.com', '(11) 97777-0003',
    1, 'waiting'
);

RAISE NOTICE '=== SEED CONCLUÍDO COM SUCESSO ===';
RAISE NOTICE 'Evento: Festival Tech 2025 | publicado | São Paulo';
RAISE NOTICE 'Ingresso: Inteira – R$ 149,90 | 200 disponíveis | 2 vendidos';
RAISE NOTICE 'Formulário: 4 campos (nome, tel, CPF, camiseta)';
RAISE NOTICE 'Cupom: TESTE10 – 10%% de desconto';
RAISE NOTICE 'Participante 1: João Silva – PIX | form: PREENCHIDO';
RAISE NOTICE 'Participante 2: Maria Santos – Cartão | form: PENDENTE';
RAISE NOTICE 'Lista de espera: Carlos Espera (posição 1)';

END;
$$;
