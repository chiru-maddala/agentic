-- Track the Twitter/X posts used as source material for each daily report

alter table reports add column if not exists sources jsonb not null default '[]'::jsonb;
