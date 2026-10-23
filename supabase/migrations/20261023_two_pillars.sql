-- Two major pillars: "AI Education" and "Education with AI".
--
-- Reports are scoped by reports.vertical ('All' | 'AI Education' | 'Education with AI').
-- Tasks, mirror signals and tracked handles carry a pillar. Goals keep their
-- existing free-form pillar column. This file is NOT applied automatically.
--
-- Non-destructive: nothing is dropped except old CHECK constraints that pinned
-- `pillar` to the previous three-pillar names, which would reject the new values.

-- Make sure the columns exist (they predate the K-12 refocus, but are not in supabase-schema.sql)
alter table reports add column if not exists vertical text not null default 'All';
alter table tasks add column if not exists pillar text;
alter table mirror_signals add column if not exists pillar text;
alter table tracked_handles add column if not exists pillar text;

-- One report per (date, scope): a day can have an 'All' report plus one per pillar
alter table reports drop constraint if exists reports_date_key;
create unique index if not exists reports_date_vertical_idx on reports(date, vertical);
create index if not exists reports_vertical_idx on reports(vertical);

-- Drop any CHECK constraint on a `pillar` column of these tables (names are unknown
-- because the tables were created outside tracked SQL).
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'c'
      and a.attname = 'pillar'
      and c.conrelid::regclass::text in ('tasks', 'mirror_signals', 'tracked_handles')
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- Remap tasks and signals tagged with the old pillar names. The old names don't map
-- one-to-one onto the new pillars, so they are left untagged ('General' for tasks, null
-- for signals/handles) and show up as "not assigned to a pillar" on the dashboard.
update tasks set pillar = 'General'
  where pillar in ('Learning AI', 'Enterprise AI', 'AI Infrastructure');
update mirror_signals set pillar = null
  where pillar in ('Learning AI', 'Enterprise AI', 'AI Infrastructure');
update tracked_handles set pillar = null
  where pillar in ('Learning AI', 'Enterprise AI', 'AI Infrastructure');
