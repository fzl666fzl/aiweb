alter table app_users
  add column if not exists membership_tier text not null default 'free';

alter table app_users
  add column if not exists membership_expires_at timestamptz;

alter table app_users
  drop constraint if exists app_users_membership_tier_check;

alter table app_users
  add constraint app_users_membership_tier_check
  check (membership_tier in ('free', 'plus', 'pro'));

create table if not exists membership_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text unique not null,
  tier text not null check (tier in ('plus', 'pro')),
  duration_days integer not null check (duration_days > 0),
  redeemed_by_user_id uuid references app_users(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists membership_codes_redeemed_idx
  on membership_codes (redeemed_at);

create index if not exists membership_codes_user_idx
  on membership_codes (redeemed_by_user_id);
