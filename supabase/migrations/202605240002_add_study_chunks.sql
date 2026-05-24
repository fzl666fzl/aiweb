alter table study_materials
  add column if not exists summary_cache text not null default '',
  add column if not exists chunk_count integer not null default 0;

create table if not exists study_material_chunks (
  id uuid primary key default gen_random_uuid(),
  study_material_id uuid not null references study_materials(id) on delete cascade,
  access_key_id uuid not null references access_keys(id),
  visitor_id text not null,
  chunk_index integer not null,
  content text not null,
  char_count integer not null,
  created_at timestamptz not null default now(),
  unique (study_material_id, chunk_index)
);

create index if not exists study_material_chunks_material_idx
  on study_material_chunks (study_material_id, chunk_index);

create index if not exists study_material_chunks_owner_idx
  on study_material_chunks (access_key_id, visitor_id, study_material_id);
