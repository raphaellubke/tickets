-- Adiciona colunas faltantes na tabela orders
-- Execute este script ANTES do seed_test_data.sql

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS participant_phone  text,
    ADD COLUMN IF NOT EXISTS payment_method     text CHECK (payment_method IN ('pix', 'card', 'boleto')),
    ADD COLUMN IF NOT EXISTS paid_at            timestamp with time zone,
    ADD COLUMN IF NOT EXISTS updated_at         timestamp with time zone DEFAULT now(),
    ADD COLUMN IF NOT EXISTS discount_amount    numeric(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS coupon_id          uuid REFERENCES public.coupons(id),
    ADD COLUMN IF NOT EXISTS quantity           int DEFAULT 1;
