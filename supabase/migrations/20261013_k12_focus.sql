-- K-12 focus: remove features outside AI Ready School and flatten pillars.
--
-- DESTRUCTIVE: drops the tables below and all their rows. Export anything you
-- want to keep (competitors, content lab, people/meetings, podcast, graph,
-- presentations) before running this. This file is NOT applied automatically.

-- Removed features ----------------------------------------------------------
drop table if exists competitor_case_studies cascade;
drop table if exists competitor_clients cascade;
drop table if exists competitors cascade;
drop table if exists content_lab cascade;
drop table if exists report_suggestions cascade;
drop table if exists podcast_episodes cascade;
drop table if exists report_nodes cascade;
drop table if exists graph_edges cascade;
drop table if exists graph_nodes cascade;
drop table if exists meeting_people cascade;
drop table if exists meetings cascade;
drop table if exists people cascade;
drop table if exists courses cascade;

-- Tasks no longer link to meetings/people and no longer have a 'meeting' source
alter table tasks drop column if exists meeting_id;
alter table tasks drop column if exists person_id;
update tasks set source = 'manual' where source = 'meeting';
alter table tasks drop constraint if exists tasks_source_check;
alter table tasks add constraint tasks_source_check
  check (source in ('manual', 'report', 'chat', 'mirror', 'goal_plan', 'voice'));

-- Goals: one flat K-12 list. Existing goals are remapped (kept) under 'K-12';
-- the pillar column is retained but no longer used by the app.
alter table mirror_pillar_goals drop constraint if exists mirror_pillar_goals_pillar_check;
drop index if exists mirror_pillar_goals_pillar_idx;
alter table mirror_pillar_goals alter column pillar set default 'K-12';
update mirror_pillar_goals set pillar = 'K-12';
