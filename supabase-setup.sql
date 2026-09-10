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

-- Disable Row Level Security for simplicity (classroom demo use)
-- If you want security, enable RLS and add policies instead
alter table public.rooms disable row level security;
alter table public.answers disable row level security;

-- Enable Realtime on both tables
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.answers;
