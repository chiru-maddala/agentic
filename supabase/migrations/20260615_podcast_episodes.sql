create table if not exists podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table podcast_episodes enable row level security;
create policy "allow all" on podcast_episodes for all using (true) with check (true);
