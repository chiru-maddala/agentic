-- Knowledge Graph: nodes, edges, and report↔node junction

create table if not exists graph_nodes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  type text not null check (type in ('concept', 'technology', 'organization', 'theme')),
  pillar text check (pillar in ('Learning AI', 'Enterprise AI', 'AI Infrastructure', 'General')),
  description text,
  mention_count int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint graph_nodes_label_unique unique (label)
);

create table if not exists graph_edges (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references graph_nodes(id) on delete cascade,
  target_id uuid not null references graph_nodes(id) on delete cascade,
  relationship text not null check (relationship in ('related_to', 'enables', 'builds_on', 'competes_with', 'part_of')),
  weight float not null default 1.0,
  created_at timestamptz not null default now(),
  constraint graph_edges_unique unique (source_id, target_id, relationship)
);

create table if not exists report_nodes (
  report_id uuid not null references reports(id) on delete cascade,
  node_id uuid not null references graph_nodes(id) on delete cascade,
  primary key (report_id, node_id)
);

-- Indexes
create index if not exists graph_edges_source_idx on graph_edges(source_id);
create index if not exists graph_edges_target_idx on graph_edges(target_id);
create index if not exists report_nodes_report_idx on report_nodes(report_id);
create index if not exists report_nodes_node_idx on report_nodes(node_id);

-- RLS: allow all authenticated users to read; only service role writes
alter table graph_nodes enable row level security;
alter table graph_edges enable row level security;
alter table report_nodes enable row level security;

create policy "graph_nodes_read" on graph_nodes for select using (auth.role() = 'authenticated');
create policy "graph_edges_read" on graph_edges for select using (auth.role() = 'authenticated');
create policy "report_nodes_read" on report_nodes for select using (auth.role() = 'authenticated');
