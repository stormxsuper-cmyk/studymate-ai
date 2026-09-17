-- StudyMate AI starter schema
-- Run this in Supabase SQL Editor.
-- The first release keeps some UI cache locally; these tables prepare the project for persistent sync.

create extension if not exists pgcrypto;

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  title text not null,
  source_text text,
  pages jsonb not null default '[]'::jsonb,
  note jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  type text not null,
  question text not null,
  options jsonb,
  answer jsonb,
  explanation text,
  topic text,
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  title text not null,
  question_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete set null,
  score integer not null default 0,
  total integer not null default 0,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.weak_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  topic text not null,
  mistakes integer not null default 0,
  last_seen timestamptz not null default now()
);

alter table public.subjects enable row level security;
alter table public.lessons enable row level security;
alter table public.questions enable row level security;
alter table public.assignments enable row level security;
alter table public.attempts enable row level security;
alter table public.weak_topics enable row level security;

create policy "subjects own rows" on public.subjects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lessons own rows" on public.lessons for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "questions own rows" on public.questions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "assignments own rows" on public.assignments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "attempts own rows" on public.attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weak topics own rows" on public.weak_topics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
