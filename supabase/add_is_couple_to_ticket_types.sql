-- Add is_couple column to event_ticket_types
ALTER TABLE event_ticket_types
ADD COLUMN IF NOT EXISTS is_couple boolean DEFAULT false;
