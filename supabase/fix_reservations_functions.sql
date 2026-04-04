-- ─── Re-apply reservation RPCs safely (policies already exist) ────────────────

-- Policies: drop first to avoid "already exists" error
DROP POLICY IF EXISTS "Anyone can read reservations"   ON public.ticket_reservations;
DROP POLICY IF EXISTS "Anyone can insert reservation"  ON public.ticket_reservations;
DROP POLICY IF EXISTS "Anyone can delete reservation"  ON public.ticket_reservations;

ALTER TABLE public.ticket_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reservations"
    ON public.ticket_reservations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reservation"
    ON public.ticket_reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete reservation"
    ON public.ticket_reservations FOR DELETE USING (true);

-- ─── RPC: reserve_tickets ─────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.reserve_tickets(JSONB, TEXT);
CREATE OR REPLACE FUNCTION public.reserve_tickets(
    p_items      JSONB,
    p_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_item           JSONB;
    v_ticket_type_id UUID;
    v_qty            INT;
    v_available      INT;
    v_sold           INT;
    v_reserved       INT;
    v_free           INT;
    v_type_name      TEXT;
    v_expires_at     TIMESTAMPTZ := NOW() + INTERVAL '10 minutes';
BEGIN
    DELETE FROM public.ticket_reservations WHERE expires_at < NOW();

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_ticket_type_id := (v_item->>'ticket_type_id')::UUID;
        v_qty            := (v_item->>'quantity')::INT;

        SELECT quantity_available, quantity_sold, name
        INTO   v_available, v_sold, v_type_name
        FROM   public.event_ticket_types
        WHERE  id = v_ticket_type_id
        FOR    UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Tipo de ingresso não encontrado');
        END IF;

        SELECT COALESCE(SUM(quantity), 0)
        INTO   v_reserved
        FROM   public.ticket_reservations
        WHERE  ticket_type_id = v_ticket_type_id
          AND  expires_at     > NOW()
          AND  session_id    <> p_session_id;

        v_free := v_available - v_sold - v_reserved;

        IF v_qty > v_free THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', CASE
                    WHEN v_free <= 0
                    THEN '"' || v_type_name || '" não tem ingressos disponíveis'
                    ELSE '"' || v_type_name || '": apenas ' || v_free || ' disponível(is)'
                END
            );
        END IF;

        DELETE FROM public.ticket_reservations
        WHERE session_id    = p_session_id
          AND ticket_type_id = v_ticket_type_id;

        INSERT INTO public.ticket_reservations
            (ticket_type_id, event_id, quantity, session_id, expires_at)
        SELECT v_ticket_type_id, ett.event_id, v_qty, p_session_id, v_expires_at
        FROM   public.event_ticket_types ett
        WHERE  ett.id = v_ticket_type_id;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'expires_at', v_expires_at);
END;
$$;

-- ─── RPC: release_reservation ─────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.release_reservation(TEXT);
CREATE OR REPLACE FUNCTION public.release_reservation(p_session_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    DELETE FROM public.ticket_reservations WHERE session_id = p_session_id;
END;
$$;

-- ─── RPC: get_reserved_counts ─────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_reserved_counts(UUID);
CREATE OR REPLACE FUNCTION public.get_reserved_counts(p_event_id UUID)
RETURNS TABLE (ticket_type_id UUID, reserved_count INT)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
    SELECT  ticket_type_id,
            COALESCE(SUM(quantity), 0)::INT AS reserved_count
    FROM    public.ticket_reservations
    WHERE   event_id   = p_event_id
      AND   expires_at > NOW()
    GROUP BY ticket_type_id;
$$;
