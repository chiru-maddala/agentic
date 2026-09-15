-- Allow 'voice' as a task source (tasks created via the voice capture interface)
alter table tasks drop constraint if exists tasks_source_check;
alter table tasks add constraint tasks_source_check
  check (source in ('manual', 'report', 'chat', 'mirror', 'meeting', 'goal_plan', 'voice'));
