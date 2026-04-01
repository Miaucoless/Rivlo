alter table profiles
  drop constraint if exists profiles_workout_split_check;

alter table profiles
  add constraint profiles_workout_split_check
  check (workout_split in ('ppl','upper_lower','3day_fullbody','4day','5day','6day','cardio_focus','custom'));
