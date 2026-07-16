-- Achieved: individual records backing a goal's progress number (e.g. one row
-- per completed school pilot). Fields are intentionally generic (title/location/
-- notes) so the same table works across every pillar's goals.
create table if not exists goal_achievements (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references mirror_pillar_goals(id) on delete cascade,
  title text not null,
  location text,
  notes text,
  achieved_at date not null default current_date,
  created_at timestamptz default now()
);

alter table goal_achievements enable row level security;
create policy "allow all" on goal_achievements for all using (true) with check (true);
create index if not exists goal_achievements_goal_id_idx on goal_achievements(goal_id);
