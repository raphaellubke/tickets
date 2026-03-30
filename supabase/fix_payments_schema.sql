-- FIX: Adiciona colunas faltantes em payments e order_items
-- Execute no Supabase SQL Editor

-- ============================================================
-- payments: adicionar colunas que podem estar faltando
-- ============================================================
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS event_id         uuid REFERENCES public.events ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS user_id          uuid REFERENCES auth.users ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS payment_method   text CHECK (payment_method IN ('pix', 'card', 'boleto')),
    ADD COLUMN IF NOT EXISTS payment_provider text,
    ADD COLUMN IF NOT EXISTS payment_provider_id text,
    ADD COLUMN IF NOT EXISTS paid_at          timestamp with time zone,
    ADD COLUMN IF NOT EXISTS updated_at       timestamp with time zone DEFAULT now();

-- ============================================================
-- order_items: total_price (algumas versões do schema têm essa coluna)
-- ============================================================
ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS total_price decimal(10,2) NOT NULL DEFAULT 0;

-- ============================================================
-- Recarregar schema cache do PostgREST
-- (necessário para que a API reconheça as novas colunas)
-- ============================================================
NOTIFY pgrst, 'reload schema';
