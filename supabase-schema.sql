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
