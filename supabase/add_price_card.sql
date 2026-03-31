-- Add card price to ticket types (PIX price stays in `price`, card price goes here)
ALTER TABLE event_ticket_types
    ADD COLUMN IF NOT EXISTS price_card NUMERIC(10,2);
