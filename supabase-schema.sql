-- Reports table
create table reports (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  content text not null,
  created_at timestamptz default now()
);

alter table reports enable row level security;
create policy "allow all" on reports for all using (true) with check (true);

-- User profiles table (approval status)
create table user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  approved boolean default false,
  created_at timestamptz default now()
);

alter table user_profiles enable row level security;

-- Users can read their own profile (needed for middleware approval check)
create policy "users can read own profile" on user_profiles
  for select using (auth.uid() = id);

-- Users can insert their own profile on registration
create policy "users can insert own profile" on user_profiles
  for insert with check (auth.uid() = id);

-- Migration: add document_content to tasks
alter table tasks add column if not exists document_content text;

-- Settings table (key-value store for context and config)
create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

alter table settings enable row level security;
create policy "allow all" on settings for all using (true) with check (true);

-- Context documents (uploaded PDFs whose extracted text is injected into agent prompts)
create table if not exists context_documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  content text not null,
  char_count integer not null default 0,
  created_at timestamptz default now()
);

alter table context_documents enable row level security;
create policy "allow all" on context_documents for all using (true) with check (true);

-- Context document chunks for full-text retrieval (see migrations/20260622_context_chunks.sql)
create table if not exists context_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references context_documents(id) on delete cascade,
  filename text not null,
  chunk_index integer not null default 0,
  content text not null,
  fts tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now()
);

create index if not exists context_chunks_fts_idx on context_chunks using gin (fts);
create index if not exists context_chunks_document_idx on context_chunks(document_id);

alter table context_chunks enable row level security;
create policy "allow all" on context_chunks for all using (true) with check (true);

create or replace function match_context_chunks(query_text text, match_count integer default 6)
returns table (id uuid, document_id uuid, filename text, content text, rank real)
language sql stable as $$
  select c.id, c.document_id, c.filename, c.content,
         ts_rank(c.fts, websearch_to_tsquery('english', query_text)) as rank
  from context_chunks c
  where c.fts @@ websearch_to_tsquery('english', query_text)
  order by rank desc
  limit match_count;
$$;

-- Measurable K-12 goals (Name, Target Number, Target Date). The pillar column
-- is retained for old data (see migrations/20261013_k12_focus.sql) but unused.
create table if not exists mirror_pillar_goals (
  id uuid primary key default gen_random_uuid(),
  pillar text not null default 'K-12',
  name text not null,
  target_number numeric,
  target_date date,
  created_at timestamptz default now()
);

alter table mirror_pillar_goals enable row level security;
create policy "allow all" on mirror_pillar_goals for all using (true) with check (true);

-- Track: manual progress entry
alter table mirror_pillar_goals add column if not exists current_value numeric;
alter table mirror_pillar_goals add column if not exists current_value_updated_at timestamptz;

-- Plan workflow: document → approve → extracted task suggestions
alter table mirror_pillar_goals add column if not exists plan_document text;
alter table mirror_pillar_goals add column if not exists plan_approved_at timestamptz;
alter table mirror_pillar_goals add column if not exists suggested_plan jsonb not null default '[]';

-- Align: tasks can point at the specific goal they serve
alter table tasks add column if not exists goal_id uuid references mirror_pillar_goals(id) on delete set null;
create index if not exists tasks_goal_id_idx on tasks(goal_id);

-- Task sources (goal_plan: approved from a goal's extracted plan tasks)
alter table tasks drop constraint if exists tasks_source_check;
alter table tasks add constraint tasks_source_check
  check (source in ('manual', 'report', 'chat', 'mirror', 'goal_plan', 'voice'));
