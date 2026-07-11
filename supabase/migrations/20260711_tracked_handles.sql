-- Curated Twitter/X handles checked first for relevant, recent tweets before falling back to keyword search
create table if not exists tracked_handles (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  pillar text,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table tracked_handles enable row level security;
create policy "allow all" on tracked_handles for all using (true) with check (true);
