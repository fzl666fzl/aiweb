create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  password_salt text not null,
  access_key_id uuid not null references access_keys(id),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint app_users_qq_email check (email ~* '^[^[:space:]@]+@qq\.com$')
);

create unique index if not exists app_users_email_idx
  on app_users (email);

create index if not exists app_users_access_key_idx
  on app_users (access_key_id);
