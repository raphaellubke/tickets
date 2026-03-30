-- Fix ticket status constraint to include 'used' (ticket was scanned/checked-in at event)
-- The original migration only had ('active', 'inactive', 'cancelled')
-- 'used' is semantically correct for checked-in tickets

alter table public.tickets
  drop constraint if exists tickets_status_check;

alter table public.tickets
  add constraint tickets_status_check
    check (status in ('active', 'used', 'cancelled', 'inactive'));
