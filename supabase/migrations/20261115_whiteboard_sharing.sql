-- Whiteboard link sharing: a board is private until its owner turns sharing on.
-- /share/whiteboard/<id> serves it read-only only while is_public is true.
alter table whiteboards add column if not exists is_public boolean not null default false;
