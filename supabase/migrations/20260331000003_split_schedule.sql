alter table profiles
  add column if not exists split_schedule jsonb not null default '{}'::jsonb;
