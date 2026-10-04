-- ============================================
-- Migration: Add question types (open / mcq / fill)
-- Run this in Supabase SQL Editor ONLY if your
-- `questions` table was created BEFORE this feature.
-- ============================================

alter table public.questions
  add column if not exists question_type text not null default 'open';

alter table public.questions
  add column if not exists options jsonb;

-- Enforce valid question types (safe to re-run)
do $$
begin
  alter table public.questions
    drop constraint if exists questions_question_type_check;
exception when others then null;
end $$;

alter table public.questions
  add constraint questions_question_type_check
  check (question_type in ('open', 'mcq', 'fill'));
