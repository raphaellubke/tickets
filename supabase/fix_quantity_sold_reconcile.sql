-- ─── Reconcile quantity_sold with actual active tickets ───────────────────────
-- Run this in Supabase SQL Editor to fix quantity_sold for ALL events.

-- 1. Set quantity_sold = real number of active tickets per ticket type
UPDATE event_ticket_types ett
SET quantity_sold = (
    SELECT COUNT(*)::INT
    FROM tickets t
    WHERE t.ticket_type_id = ett.id
      AND t.status IN ('active', 'used')
);

-- 2. Fix any row where quantity_sold ended up > quantity_available
--    (means quantity_available was set too low — bump it up to match)
UPDATE event_ticket_types
SET quantity_available = quantity_sold
WHERE quantity_sold > quantity_available;

-- 3. Drop and re-add constraint safely
ALTER TABLE event_ticket_types DROP CONSTRAINT IF EXISTS no_oversell;
ALTER TABLE event_ticket_types
    ADD CONSTRAINT no_oversell CHECK (quantity_sold <= quantity_available);

-- 4. Create/replace increment function
DROP FUNCTION IF EXISTS increment_quantity_sold(UUID);
CREATE OR REPLACE FUNCTION increment_quantity_sold(p_ticket_type_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_available INT;
    v_sold      INT;
BEGIN
    SELECT quantity_available, quantity_sold
    INTO v_available, v_sold
    FROM event_ticket_types
    WHERE id = p_ticket_type_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_sold >= v_available THEN
        RETURN FALSE;
    END IF;

    UPDATE event_ticket_types
    SET quantity_sold = quantity_sold + 1
    WHERE id = p_ticket_type_id;

    RETURN TRUE;
END;
$$;

-- 5. Verify the specific event (optional — just to confirm)
SELECT
    ett.id,
    ett.name,
    ett.quantity_available,
    ett.quantity_sold,
    COUNT(t.id) AS tickets_in_db
FROM event_ticket_types ett
LEFT JOIN tickets t ON t.ticket_type_id = ett.id AND t.status IN ('active', 'used')
WHERE ett.event_id = '63429d9e-732e-43f1-a6d0-83ca072a3379'
GROUP BY ett.id, ett.name, ett.quantity_available, ett.quantity_sold;
