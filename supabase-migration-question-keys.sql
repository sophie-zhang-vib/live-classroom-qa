-- ============================================
-- Migration: Hide correct answers from students
-- Moves `correct_answer` out of the public `questions` table into
-- `question_keys` (no SELECT policy, not in realtime), and adds a
-- teacher-key-gated RPC for reading it back in the edit modal.
-- Run this in Supabase SQL Editor.
--
-- Idempotent: safe to run on fresh DBs too (if the legacy
-- correct_answer column never existed, the migration step skips).
-- ============================================

-- 1. Per-room teacher keys. Teachers are anonymous users too, so key
--    creation is allowed but nobody can read keys back via the API.
create table if not exists public.room_secrets (
  room_id text primary key references public.rooms(room_id) on delete cascade,
  teacher_key text not null
);

alter table public.room_secrets enable row level security;

drop policy if exists "room_secrets_insert" on public.room_secrets;
create policy "room_secrets_insert" on public.room_secrets
  for insert with check (true);
-- (intentionally NO select/update/delete policies)

-- 2. Answer keys in their own table: without a SELECT policy, nobody
--    can read them through PostgREST, and the table is NOT added to the
--    realtime publication, so payloads never carry correct answers.
create table if not exists public.question_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  correct_answer text not null
);

alter table public.question_keys enable row level security;

-- Writes stay open (same trust level as the rest of the app);
-- reads are denied so students can never fetch correct answers.
drop policy if exists "question_keys_insert" on public.question_keys;
create policy "question_keys_insert" on public.question_keys
  for insert with check (true);

drop policy if exists "question_keys_update" on public.question_keys;
create policy "question_keys_update" on public.question_keys
  for update using (true) with check (true);

drop policy if exists "question_keys_delete" on public.question_keys;
create policy "question_keys_delete" on public.question_keys
  for delete using (true);
-- (intentionally NO select policy)

-- 3. Migrate existing correct answers (only if the legacy column exists).
--    Fresh DBs built from the new supabase-setup.sql never had this
--    column, so the step silently skips — the table above is already
--    the sole home for answer keys.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'questions' and column_name = 'correct_answer'
  ) then
    insert into public.question_keys (question_id, correct_answer)
    select id, correct_answer from public.questions
    where correct_answer is not null
    on conflict (question_id) do nothing;
  end if;
end;
$$;

-- 4. Teacher-only read, gated by the room's teacher key
create or replace function public.get_question_key(p_room_id text, p_teacher_key text, p_question_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.room_secrets
    where room_id = p_room_id and teacher_key = p_teacher_key
  ) then
    return null;
  end if;
  return (
    select k.correct_answer
    from public.question_keys k
    join public.questions q on q.id = k.question_id
    where k.question_id = p_question_id and q.room_id = p_room_id
  );
end;
$$;

-- 5. Drop the leaked column (if it still exists) so realtime payloads
--    stop carrying it. Fresh DBs never had it — no-op there.
alter table public.questions drop column if exists correct_answer;

-- NOTE: rooms created before this migration have no row in room_secrets,
-- so their answer keys are read-only-by-nobody. New classrooms get a key
-- automatically when created from the entry page.
