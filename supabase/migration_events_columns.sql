-- ============================================================
-- MIGRATION: Adicionar colunas faltantes nas tabelas events e forms
-- Execute este arquivo no Supabase SQL Editor
-- ============================================================

alter table public.events
  add column if not exists user_id uuid references auth.users on delete set null,
  add column if not exists created_by uuid references auth.users on delete set null,
  add column if not exists end_date date,
  add column if not exists end_time time,
  add column if not exists address text,
  add column if not exists address_notes text,
  add column if not exists allow_waitlist boolean default false,
  add column if not exists tags text[],
  add column if not exists send_reminder boolean default true;

-- Atualizar constraint de status para incluir os valores corretos
-- (remover e recriar a constraint)
alter table public.events drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check
  check (status in ('draft', 'published', 'ended', 'cancelled'));

-- Garantir que eventos existentes com status inválido virem 'draft'
update public.events
  set status = 'draft'
  where status not in ('draft', 'published', 'ended', 'cancelled');

-- ============================================================
-- FORMS: adicionar colunas faltantes
-- ============================================================

-- Adicionar colunas faltantes
alter table public.forms
  add column if not exists status text default 'draft' check (status in ('draft', 'active', 'closed')),
  add column if not exists user_id uuid references auth.users on delete set null,
  add column if not exists created_by uuid references auth.users on delete set null,
  add column if not exists is_active boolean default false;

-- Sincronizar is_active com status
update public.forms set is_active = (status = 'active');

