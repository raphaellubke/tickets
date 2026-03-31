-- ─── Ticket Reservations: 10-minute soft hold ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ticket_reservations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_type_id  UUID NOT NULL REFERENCES public.event_ticket_types(id) ON DELETE CASCADE,
    event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    quantity        INT  NOT NULL CHECK (quantity > 0),
    session_id      TEXT NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_type_expires ON public.ticket_reservations (ticket_type_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_reservations_session      ON public.ticket_reservations (session_id);

ALTER TABLE public.ticket_reservations ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed for createOrder availability check from client)
CREATE POLICY "Anyone can read reservations"
    ON public.ticket_reservations FOR SELECT
    USING (true);

-- RPCs (SECURITY DEFINER) handle insert/delete — but allow anon for direct client use
CREATE POLICY "Anyone can insert reservation"
    ON public.ticket_reservations FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can delete reservation"
    ON public.ticket_reservations FOR DELETE
    USING (true);


-- ─── RPC: reserve_tickets ──────────────────────────────────────────────────────
-- Atomically reserves seats for a checkout session.
-- Returns: { success, expires_at, error? }

DROP FUNCTION IF EXISTS public.reserve_tickets(JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.reserve_tickets(
    p_items      JSONB,   -- [{ticket_type_id: uuid, quantity: int}, ...]
    p_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    -- 1. Lazy cleanup of all expired reservations
    DELETE FROM public.ticket_reservations WHERE expires_at < NOW();

    -- 2. Process each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_ticket_type_id := (v_item->>'ticket_type_id')::UUID;
        v_qty            := (v_item->>'quantity')::INT;

        -- Lock the row to prevent concurrent race conditions
        SELECT quantity_available, quantity_sold, name
        INTO   v_available, v_sold, v_type_name
        FROM   public.event_ticket_types
        WHERE  id = v_ticket_type_id
        FOR    UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Tipo de ingresso não encontrado');
        END IF;

        -- Count active reservations from OTHER sessions only
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

        -- Remove previous reservation for this session + ticket type (refresh)
        DELETE FROM public.ticket_reservations
        WHERE session_id    = p_session_id
          AND ticket_type_id = v_ticket_type_id;

        -- Insert new reservation
        INSERT INTO public.ticket_reservations
            (ticket_type_id, event_id, quantity, session_id, expires_at)
        SELECT
            v_ticket_type_id,
            ett.event_id,
            v_qty,
            p_session_id,
            v_expires_at
        FROM public.event_ticket_types ett
        WHERE ett.id = v_ticket_type_id;

    END LOOP;

    RETURN jsonb_build_object(
        'success',    true,
        'expires_at', v_expires_at
    );
END;
$$;


-- ─── RPC: release_reservation ─────────────────────────────────────────────────
-- Deletes all reservations for a session (call on payment success).

DROP FUNCTION IF EXISTS public.release_reservation(TEXT);

CREATE OR REPLACE FUNCTION public.release_reservation(p_session_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.ticket_reservations WHERE session_id = p_session_id;
END;
$$;


-- ─── RPC: get_reserved_counts ─────────────────────────────────────────────────
-- Returns active reservation totals per ticket type for an event.
-- Used by the event page to show accurate availability.

DROP FUNCTION IF EXISTS public.get_reserved_counts(UUID);

CREATE OR REPLACE FUNCTION public.get_reserved_counts(p_event_id UUID)
RETURNS TABLE (ticket_type_id UUID, reserved_count INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT  ticket_type_id,
            COALESCE(SUM(quantity), 0)::INT AS reserved_count
    FROM    public.ticket_reservations
    WHERE   event_id   = p_event_id
      AND   expires_at > NOW()
    GROUP BY ticket_type_id;
$$;
