-- Reports become vertical-scoped: a report can target a single Intellina
-- pillar (Learning AI / Enterprise AI / AI Infrastructure) or 'All' (the
-- original combined report). One report per (date, vertical) instead of
-- one per date, since a day can now have up to four reports.

alter table reports add column if not exists vertical text not null default 'All';

alter table reports drop constraint if exists reports_date_key;
create unique index if not exists reports_date_vertical_idx on reports(date, vertical);
create index if not exists reports_vertical_idx on reports(vertical);
