-- ─── Fix oversell constraint + increment function ─────────────────────────────
-- Run this instead of fix_ticket_oversell.sql

-- 1. Fix any existing rows where quantity_sold > quantity_available
--    (set quantity_available = quantity_sold so data is valid before adding constraint)
UPDATE event_ticket_types
SET quantity_available = quantity_sold
WHERE quantity_sold > quantity_available;

-- 2. Add/re-add the constraint safely
ALTER TABLE event_ticket_types
    DROP CONSTRAINT IF EXISTS no_oversell;

ALTER TABLE event_ticket_types
    ADD CONSTRAINT no_oversell
    CHECK (quantity_sold <= quantity_available);

-- 3. Create/replace the increment function
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
        RETURN FALSE; -- Already at capacity
    END IF;

    UPDATE event_ticket_types
    SET quantity_sold = quantity_sold + 1
    WHERE id = p_ticket_type_id;

    RETURN TRUE;
END;
$$;
