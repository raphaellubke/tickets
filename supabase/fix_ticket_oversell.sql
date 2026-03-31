-- Prevent overselling: DB-level constraint on event_ticket_types
ALTER TABLE event_ticket_types
    ADD CONSTRAINT no_oversell
    CHECK (quantity_sold <= quantity_available);

-- Replace increment_quantity_sold RPC to enforce the constraint safely
-- Returns TRUE if incremented, FALSE if already at capacity
DROP FUNCTION IF EXISTS increment_quantity_sold(UUID);
CREATE OR REPLACE FUNCTION increment_quantity_sold(p_ticket_type_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_available INT;
    v_sold      INT;
BEGIN
    -- Lock the row to prevent concurrent increments
    SELECT quantity_available, quantity_sold
    INTO v_available, v_sold
    FROM event_ticket_types
    WHERE id = p_ticket_type_id
    FOR UPDATE;

    IF v_sold >= v_available THEN
        RETURN FALSE; -- Already at capacity
    END IF;

    UPDATE event_ticket_types
    SET quantity_sold = quantity_sold + 1
    WHERE id = p_ticket_type_id;

    RETURN TRUE;
END;
$$;
