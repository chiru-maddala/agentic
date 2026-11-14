-- Whiteboards: freeform drawing boards. `data` holds the drawn shapes as JSON
-- ({ shapes: [...] }); `thumbnail` is a small PNG data URL shown on the board list.
create table if not exists whiteboards (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled board',
  data jsonb not null default '{"shapes":[]}'::jsonb,
  thumbnail text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table whiteboards enable row level security;
create policy "allow all" on whiteboards for all using (true) with check (true);
