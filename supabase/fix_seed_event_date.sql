-- Atualiza o evento de teste para ter uma data futura
UPDATE public.events
SET event_date = '2026-06-15'
WHERE name = 'Festival Tech 2025'
  AND status = 'published';
