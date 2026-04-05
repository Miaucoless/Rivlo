alter table profiles
  add column if not exists bio text,
  add column if not exists profile_visibility text not null default 'public'
    check (profile_visibility in ('public','private'));
