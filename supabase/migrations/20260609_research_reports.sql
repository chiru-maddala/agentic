-- Research reports: user-submitted PDFs/URLs analyzed by Claude

create table if not exists research_reports (
  id uuid primary key default gen_random_uuid(),
  title text,
  content text,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists research_reports_created_idx on research_reports(created_at desc);

alter table research_reports enable row level security;

drop policy if exists "research_reports_read" on research_reports;
drop policy if exists "research_reports_insert" on research_reports;
drop policy if exists "research_reports_delete" on research_reports;

create policy "research_reports_read" on research_reports
  for select to authenticated using (true);

create policy "research_reports_insert" on research_reports
  for insert to authenticated with check (true);

create policy "research_reports_delete" on research_reports
  for delete to authenticated using (true);

create policy "research_reports_update" on research_reports
  for update to authenticated using (true);
