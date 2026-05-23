create table if not exists study_materials (
  id uuid primary key default gen_random_uuid(),
  access_key_id uuid not null references access_keys(id),
  visitor_id text not null,
  conversation_id uuid references conversations(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  extracted_text text not null,
  summary_preview text not null,
  text_length integer not null,
  created_at timestamptz not null default now()
);

create index if not exists study_materials_owner_idx
  on study_materials (access_key_id, visitor_id, created_at desc);

create index if not exists study_materials_conversation_idx
  on study_materials (conversation_id);
