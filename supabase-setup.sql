-- ============================================
-- Live Classroom Q&A — Supabase Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- Rooms table: stores the current active question per room
create table if not exists public.rooms (
  room_id text primary key,
  question text,
  created_at timestamptz not null default now()
);

-- Answers table: stores all student answers
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(room_id) on delete cascade,
  answer text not null,
  student_name text not null default 'Anonymous',
  created_at timestamptz not null default now()
);

create index if not exists answers_room_id_idx on public.answers(room_id);

-- Enable Row Level Security
alter table public.rooms enable row level security;
alter table public.answers enable row level security;

-- Rooms: allow anyone to read, create, and update (teacher posts/ends questions)
drop policy if exists "rooms_select" on public.rooms;
drop policy if exists "rooms_insert" on public.rooms;
drop policy if exists "rooms_update" on public.rooms;

create policy "rooms_select" on public.rooms
  for select using (true);

create policy "rooms_insert" on public.rooms
  for insert with check (true);

create policy "rooms_update" on public.rooms
  for update using (true) with check (true);

-- Answers: allow anyone to read, submit, and delete (teacher clears old answers)
drop policy if exists "answers_select" on public.answers;
drop policy if exists "answers_insert" on public.answers;
drop policy if exists "answers_delete" on public.answers;

create policy "answers_select" on public.answers
  for select using (true);

create policy "answers_insert" on public.answers
  for insert with check (true);

create policy "answers_delete" on public.answers
  for delete using (true);

-- Enable Realtime on both tables
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.answers;
