-- Track: manual progress entry
alter table mirror_pillar_goals add column if not exists current_value numeric;
alter table mirror_pillar_goals add column if not exists current_value_updated_at timestamptz;

-- Plan workflow: document → approve → extracted task suggestions
alter table mirror_pillar_goals add column if not exists plan_document text;
alter table mirror_pillar_goals add column if not exists plan_approved_at timestamptz;
alter table mirror_pillar_goals add column if not exists suggested_plan jsonb not null default '[]';

-- Align: tasks and meetings can point at the specific goal they serve
alter table tasks add column if not exists goal_id uuid references mirror_pillar_goals(id) on delete set null;
alter table meetings add column if not exists goal_id uuid references mirror_pillar_goals(id) on delete set null;
create index if not exists tasks_goal_id_idx on tasks(goal_id);
create index if not exists meetings_goal_id_idx on meetings(goal_id);

-- Allow 'goal_plan' as a task source (approved from a goal's extracted plan tasks)
alter table tasks drop constraint if exists tasks_source_check;
alter table tasks add constraint tasks_source_check
  check (source in ('manual', 'report', 'chat', 'mirror', 'meeting', 'goal_plan'));
