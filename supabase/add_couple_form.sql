-- Adiciona suporte a formulários de casal (Ele/Ela)
ALTER TABLE public.forms
    ADD COLUMN IF NOT EXISTS is_couple boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
