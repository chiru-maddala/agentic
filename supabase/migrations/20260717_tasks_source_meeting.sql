-- Allow 'meeting' as a task source (action items accepted from a Meeting's suggestions)
alter table tasks drop constraint if exists tasks_source_check;
alter table tasks add constraint tasks_source_check
  check (source in ('manual', 'report', 'chat', 'mirror', 'meeting'));
