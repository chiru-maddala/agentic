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

-- Courses table
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slides text not null,
  slide_count integer not null default 0,
  created_at timestamptz default now()
);

alter table courses enable row level security;
create policy "allow all" on courses for all using (true) with check (true);

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

-- Content Lab table
create table if not exists content_lab (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('article', 'social')),
  title text not null,
  concept text not null,
  status text not null default 'pending' check (status in ('pending', 'generated')),
  platform text,
  word_count integer,
  keywords text[] default '{}',
  generated_content text,
  created_at timestamptz default now()
);

alter table content_lab enable row level security;
create policy "allow all" on content_lab for all using (true) with check (true);

-- Report suggestions table (persists Content Lab suggestions per report)
create table if not exists report_suggestions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references reports(id) on delete cascade,
  blog_posts jsonb not null default '[]',
  social_posts jsonb not null default '[]',
  created_at timestamptz default now()
);

alter table report_suggestions enable row level security;
create policy "allow all" on report_suggestions for all using (true) with check (true);

-- Podcast episodes table (The AI Sense)
create table if not exists podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table podcast_episodes enable row level security;
create policy "allow all" on podcast_episodes for all using (true) with check (true);

-- Competitive Intelligence: Competitors
create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text not null,
  description text,
  founding_year integer,
  hq text,
  funding_stage text,
  total_raised text,
  team_size text,
  pricing_model text,
  positioning text,
  target_industries text[] default '{}',
  target_company_size text[] default '{}',
  geographies text[] default '{}',
  tech_stack text[] default '{}',
  differentiators text[] default '{}',
  content_themes text[] default '{}',
  pillars text[] default '{}',
  share_id text unique default encode(gen_random_bytes(12), 'hex'),
  last_refreshed_at timestamptz,
  created_at timestamptz default now()
);

alter table competitors enable row level security;
create policy "allow all" on competitors for all using (true) with check (true);

-- Competitive Intelligence: Clients (named customers of a competitor)
create table if not exists competitor_clients (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors(id) on delete cascade,
  name text not null,
  industry text,
  company_size text,
  geography text,
  notes text,
  created_at timestamptz default now()
);

alter table competitor_clients enable row level security;
create policy "allow all" on competitor_clients for all using (true) with check (true);

-- Unique constraint to allow upsert by name per competitor
alter table competitor_clients add constraint if not exists competitor_clients_competitor_id_name_key unique (competitor_id, name);

-- Competitive Intelligence: Case Studies
create table if not exists competitor_case_studies (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors(id) on delete cascade,
  client_id uuid references competitor_clients(id) on delete set null,
  title text not null,
  pillar text check (pillar in ('Learning AI', 'Enterprise AI', 'AI Infrastructure')),
  industry text,
  function text,
  tools text[] default '{}',
  outcome_metric text,
  source_url text,
  notes text,
  created_at timestamptz default now()
);

alter table competitor_case_studies enable row level security;
create policy "allow all" on competitor_case_studies for all using (true) with check (true);

-- People: internal/external contacts with notes and a manually-entered status
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('internal', 'external')),
  role text,
  company text,
  email text,
  primary_pillar text check (primary_pillar in ('Learning AI', 'Enterprise AI', 'AI Infrastructure')),
  notes text,
  status_note text,
  status_updated_at timestamptz,
  created_at timestamptz default now()
);

alter table people enable row level security;
create policy "allow all" on people for all using (true) with check (true);

-- Meetings: captures details + AI-extracted candidate action items
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_date date not null,
  pillar text check (pillar in ('Learning AI', 'Enterprise AI', 'AI Infrastructure')),
  notes text,
  suggested_tasks jsonb not null default '[]',
  created_at timestamptz default now()
);

alter table meetings enable row level security;
create policy "allow all" on meetings for all using (true) with check (true);

-- Meeting attendees (many-to-many)
create table if not exists meeting_people (
  meeting_id uuid not null references meetings(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  primary key (meeting_id, person_id)
);

alter table meeting_people enable row level security;
create policy "allow all" on meeting_people for all using (true) with check (true);

-- Link tasks to the person responsible and/or the meeting they came from
alter table tasks add column if not exists person_id uuid references people(id) on delete set null;
alter table tasks add column if not exists meeting_id uuid references meetings(id) on delete set null;
create index if not exists tasks_person_id_idx on tasks(person_id);
create index if not exists tasks_meeting_id_idx on tasks(meeting_id);

-- Allow 'meeting' as a task source (action items accepted from a Meeting's suggestions)
alter table tasks drop constraint if exists tasks_source_check;
alter table tasks add constraint tasks_source_check
  check (source in ('manual', 'report', 'chat', 'mirror', 'meeting'));
