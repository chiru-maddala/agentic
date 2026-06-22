-- Full-text retrieval over uploaded context documents.
-- Documents are split into chunks; chat and generators retrieve only the
-- chunks relevant to the current query instead of injecting every document.

create table if not exists context_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references context_documents(id) on delete cascade,
  filename text not null,
  chunk_index integer not null default 0,
  content text not null,
  fts tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now()
);

create index if not exists context_chunks_fts_idx on context_chunks using gin (fts);
create index if not exists context_chunks_document_idx on context_chunks(document_id);

alter table context_chunks enable row level security;
drop policy if exists "allow all" on context_chunks;
create policy "allow all" on context_chunks for all using (true) with check (true);

-- Ranked full-text retrieval. Returns the top matching chunks for a query,
-- ordered by relevance. Uses websearch_to_tsquery so plain phrases work.
create or replace function match_context_chunks(query_text text, match_count integer default 6)
returns table (
  id uuid,
  document_id uuid,
  filename text,
  content text,
  rank real
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    c.filename,
    c.content,
    ts_rank(c.fts, websearch_to_tsquery('english', query_text)) as rank
  from context_chunks c
  where c.fts @@ websearch_to_tsquery('english', query_text)
  order by rank desc
  limit match_count;
$$;
