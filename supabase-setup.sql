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
  file_url text,
  file_name text,
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

-- Reactions table: like, inspiring, surprise per answer per student
create table if not exists public.answer_reactions (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  student_name text not null,
  reaction_type text not null check (reaction_type in ('like', 'inspiring', 'surprise')),
  created_at timestamptz not null default now(),
  unique (answer_id, student_name, reaction_type)
);

create index if not exists answer_reactions_answer_id_idx on public.answer_reactions(answer_id);

-- Comments table: threaded comments on answers
create table if not exists public.answer_comments (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  student_name text not null,
  comment_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists answer_comments_answer_id_idx on public.answer_comments(answer_id);

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

-- Answer reactions: allow anyone to read, create, and delete their own
alter table public.answer_reactions enable row level security;
drop policy if exists "answer_reactions_select" on public.answer_reactions;
drop policy if exists "answer_reactions_insert" on public.answer_reactions;
drop policy if exists "answer_reactions_delete" on public.answer_reactions;

create policy "answer_reactions_select" on public.answer_reactions
  for select using (true);

create policy "answer_reactions_insert" on public.answer_reactions
  for insert with check (true);

create policy "answer_reactions_delete" on public.answer_reactions
  for delete using (true);

-- Answer comments: allow anyone to read, create, and delete their own
alter table public.answer_comments enable row level security;
drop policy if exists "answer_comments_select" on public.answer_comments;
drop policy if exists "answer_comments_insert" on public.answer_comments;
drop policy if exists "answer_comments_delete" on public.answer_comments;

create policy "answer_comments_select" on public.answer_comments
  for select using (true);

create policy "answer_comments_insert" on public.answer_comments
  for insert with check (true);

create policy "answer_comments_delete" on public.answer_comments
  for delete using (true);

-- Enable Realtime on all tables
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.questions;
alter publication supabase_realtime add table public.answers;
alter publication supabase_realtime add table public.answer_reactions;
alter publication supabase_realtime add table public.answer_comments;

-- ============================================
-- Storage buckets for file attachments
-- ============================================

-- Answer files bucket
insert into storage.buckets (id, name, public)
values ('answer-files', 'answer-files', true)
on conflict (id) do nothing;

drop policy if exists "Public read access to answer files" on storage.objects;
create policy "Public read access to answer files" on storage.objects
  for select using (bucket_id = 'answer-files'::text);

drop policy if exists "Allow anon uploads to answer files" on storage.objects;
create policy "Allow anon uploads to answer files" on storage.objects
  for insert with check (bucket_id = 'answer-files'::text);

-- Question files bucket
insert into storage.buckets (id, name, public)
values ('question-files', 'question-files', true)
on conflict (id) do nothing;

drop policy if exists "Public read access to question files" on storage.objects;
create policy "Public read access to question files" on storage.objects
  for select using (bucket_id = 'question-files'::text);

drop policy if exists "Allow anon uploads to question files" on storage.objects;
create policy "Allow anon uploads to question files" on storage.objects
  for insert with check (bucket_id = 'question-files'::text);
