create table reports (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  content text not null,
  created_at timestamptz default now()
);

-- Allow public read/write (lock down with RLS if needed)
alter table reports enable row level security;

create policy "allow all" on reports for all using (true) with check (true);
