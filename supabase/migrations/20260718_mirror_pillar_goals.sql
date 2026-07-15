-- Measurable goals per pillar (Name, Target Number, Target Date), replacing
-- the old free-text mirror_goals fields in the Intent tab. mirror_goals is
-- left in place, just no longer read/written.
create table if not exists mirror_pillar_goals (
  id uuid primary key default gen_random_uuid(),
  pillar text not null check (pillar in ('Learning AI', 'Enterprise AI', 'AI Infrastructure')),
  name text not null,
  target_number numeric,
  target_date date,
  created_at timestamptz default now()
);

alter table mirror_pillar_goals enable row level security;
create policy "allow all" on mirror_pillar_goals for all using (true) with check (true);
create index if not exists mirror_pillar_goals_pillar_idx on mirror_pillar_goals(pillar);
