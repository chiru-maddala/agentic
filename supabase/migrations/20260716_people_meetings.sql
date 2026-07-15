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
