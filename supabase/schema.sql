create extension if not exists pgcrypto;

create table if not exists access_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  key_hash text unique not null,
  enabled boolean not null default true,
  daily_limit integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  password_salt text not null,
  access_key_id uuid not null references access_keys(id),
  membership_tier text not null default 'free',
  membership_expires_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint app_users_qq_email check (email ~* '^[^[:space:]@]+@qq\.com$'),
  constraint app_users_membership_tier_check check (membership_tier in ('free', 'plus', 'pro'))
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  access_key_id uuid not null references access_keys(id),
  visitor_id text not null,
  title text not null,
  app_id text not null default 'mamanshuo',
  persona_id text not null default 'maman',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists study_materials (
  id uuid primary key default gen_random_uuid(),
  access_key_id uuid not null references access_keys(id),
  visitor_id text not null,
  conversation_id uuid references conversations(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  extracted_text text not null,
  summary_preview text not null,
  summary_cache text not null default '',
  text_length integer not null,
  chunk_count integer not null default 0,
  created_at timestamptz not null default now()
);

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

create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  access_key_id uuid not null references access_keys(id),
  visitor_id text not null,
  usage_date date not null,
  request_count integer not null default 0,
  unique (access_key_id, visitor_id, usage_date)
);

create table if not exists membership_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text unique not null,
  tier text not null check (tier in ('plus', 'pro')),
  duration_days integer not null check (duration_days > 0),
  redeemed_by_user_id uuid references app_users(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table conversations add column if not exists app_id text not null default 'mamanshuo';
alter table conversations add column if not exists persona_id text not null default 'maman';

create index if not exists conversations_owner_idx
  on conversations (access_key_id, visitor_id, updated_at desc);

create index if not exists conversations_owner_app_idx
  on conversations (access_key_id, visitor_id, app_id, updated_at desc);

create unique index if not exists app_users_email_idx
  on app_users (email);

create index if not exists app_users_access_key_idx
  on app_users (access_key_id);

create index if not exists messages_conversation_idx
  on messages (conversation_id, created_at asc);

create index if not exists study_materials_owner_idx
  on study_materials (access_key_id, visitor_id, created_at desc);

create index if not exists study_materials_conversation_idx
  on study_materials (conversation_id);

create index if not exists study_material_chunks_material_idx
  on study_material_chunks (study_material_id, chunk_index);

create index if not exists study_material_chunks_owner_idx
  on study_material_chunks (access_key_id, visitor_id, study_material_id);

create index if not exists usage_logs_date_idx
  on usage_logs (access_key_id, usage_date);

create index if not exists membership_codes_redeemed_idx
  on membership_codes (redeemed_at);

create index if not exists membership_codes_user_idx
  on membership_codes (redeemed_by_user_id);

create or replace function increment_usage_if_allowed(
  p_access_key_id uuid,
  p_visitor_id text,
  p_usage_date date,
  p_access_limit integer,
  p_visitor_limit integer
)
returns table (allowed boolean, reason text)
language plpgsql
as $$
declare
  access_total integer;
  visitor_total integer;
begin
  select coalesce(sum(request_count), 0)
    into access_total
    from usage_logs
    where access_key_id = p_access_key_id
      and usage_date = p_usage_date;

  select coalesce(request_count, 0)
    into visitor_total
    from usage_logs
    where access_key_id = p_access_key_id
      and visitor_id = p_visitor_id
      and usage_date = p_usage_date;

  if access_total >= p_access_limit then
    return query select false, 'access_key_daily_limit';
    return;
  end if;

  if visitor_total >= p_visitor_limit then
    return query select false, 'visitor_daily_limit';
    return;
  end if;

  insert into usage_logs (access_key_id, visitor_id, usage_date, request_count)
  values (p_access_key_id, p_visitor_id, p_usage_date, 1)
  on conflict (access_key_id, visitor_id, usage_date)
  do update set request_count = usage_logs.request_count + 1;

  return query select true, 'ok';
end;
$$;
