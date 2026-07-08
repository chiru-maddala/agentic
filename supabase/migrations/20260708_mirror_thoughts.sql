create table if not exists mirror_thoughts (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(content) <= 280),
  hashtags text[] not null default '{}',
  created_at timestamptz default now()
);

create index if not exists mirror_thoughts_hashtags_idx on mirror_thoughts using gin (hashtags);
create index if not exists mirror_thoughts_created_at_idx on mirror_thoughts (created_at desc);

alter table mirror_thoughts enable row level security;
create policy "allow all" on mirror_thoughts for all using (true) with check (true);
