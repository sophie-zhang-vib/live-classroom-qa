-- ============================================
-- Live Classroom Q&A — Supabase Setup
-- Run this in Supabase SQL Editor
-- Multi-question architecture
-- ============================================

-- Rooms table: one row per classroom
create table if not exists public.rooms (
  room_id text primary key,
  created_at timestamptz not null default now()
);

-- Questions table: multiple questions per room
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(room_id) on delete cascade,
  question_text text not null,
  correct_answer text,
  show_answer boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists questions_room_id_idx on public.questions(room_id);

-- Answers table: linked to a specific question
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(room_id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  answer text not null,
  student_name text not null default 'Anonymous',
  created_at timestamptz not null default now()
);

create index if not exists answers_room_id_idx on public.answers(room_id);
create index if not exists answers_question_id_idx on public.answers(question_id);

-- Enable Row Level Security
alter table public.rooms enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;

-- Rooms: allow anyone to read, create, and update
drop policy if exists "rooms_select" on public.rooms;
drop policy if exists "rooms_insert" on public.rooms;
drop policy if exists "rooms_update" on public.rooms;

create policy "rooms_select" on public.rooms
  for select using (true);

create policy "rooms_insert" on public.rooms
  for insert with check (true);

create policy "rooms_update" on public.rooms
  for update using (true) with check (true);

-- Questions: allow anyone to read, create, update (toggle show_answer), and delete
drop policy if exists "questions_select" on public.questions;
drop policy if exists "questions_insert" on public.questions;
drop policy if exists "questions_update" on public.questions;
drop policy if exists "questions_delete" on public.questions;

create policy "questions_select" on public.questions
  for select using (true);

create policy "questions_insert" on public.questions
  for insert with check (true);

create policy "questions_update" on public.questions
  for update using (true) with check (true);

create policy "questions_delete" on public.questions
  for delete using (true);

-- Answers: allow anyone to read, submit, and delete
drop policy if exists "answers_select" on public.answers;
drop policy if exists "answers_insert" on public.answers;
drop policy if exists "answers_delete" on public.answers;

create policy "answers_select" on public.answers
  for select using (true);

create policy "answers_insert" on public.answers
  for insert with check (true);

create policy "answers_delete" on public.answers
  for delete using (true);

-- Enable Realtime on all tables
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.questions;
alter publication supabase_realtime add table public.answers;
