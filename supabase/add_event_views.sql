-- Adiciona contador de visualizações na tabela events
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;

-- RPC para incrementar views atomicamente (evita race condition)
CREATE OR REPLACE FUNCTION public.increment_event_views(p_event_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    UPDATE public.events
    SET views = views + 1
    WHERE id = p_event_id;
$$;
