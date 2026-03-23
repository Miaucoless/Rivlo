ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS goal_target_change_kg NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS goal_timeframe_weeks INTEGER,
  ADD COLUMN IF NOT EXISTS preferred_workout_time TEXT
  CHECK (preferred_workout_time IN ('early_morning','morning','afternoon','evening','late_night','flexible')),
  ADD COLUMN IF NOT EXISTS preferred_foods TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avoided_foods TEXT[] DEFAULT '{}';
