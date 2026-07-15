-- Split mirror_signals into World Signals (external intelligence) vs Actions (what Chiru did)
alter table mirror_signals add column if not exists category text not null default 'action';

update mirror_signals
set category = 'world'
where type in ('report_insight', 'report_strategic', 'report_generated', 'research_done');

alter table mirror_signals add constraint mirror_signals_category_check check (category in ('world', 'action'));
