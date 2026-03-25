-- ============================================================
-- Rivlo — Supabase Database Schema
-- ============================================================
-- Run this in your Supabase SQL editor to set up all tables.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users / Profiles ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  avatar_url    TEXT,
  height_cm     NUMERIC(5,1) NOT NULL DEFAULT 175,
  weight_kg     NUMERIC(5,2) NOT NULL DEFAULT 75,
  age           INTEGER NOT NULL DEFAULT 25,
  unit_system   TEXT NOT NULL DEFAULT 'imperial' CHECK (unit_system IN ('imperial', 'metric')),
  gender        TEXT NOT NULL DEFAULT 'male' CHECK (gender IN ('male', 'female', 'other')),
  activity_level TEXT NOT NULL DEFAULT 'moderately_active'
    CHECK (activity_level IN ('sedentary','lightly_active','moderately_active','very_active','extra_active')),
  fitness_goal  TEXT NOT NULL DEFAULT 'fat_loss'
    CHECK (fitness_goal IN ('fat_loss','muscle_gain','maintenance','athletic_performance')),
  workout_split TEXT NOT NULL DEFAULT 'ppl'
    CHECK (workout_split IN ('ppl','upper_lower','3day_fullbody','4day','5day','6day','cardio_focus')),
  goal_target_change_kg NUMERIC(5,2),
  goal_timeframe_weeks INTEGER,
  preferred_workout_time TEXT CHECK (preferred_workout_time IN ('early_morning','morning','afternoon','evening','late_night','flexible')),
  preferred_foods TEXT[] DEFAULT '{}',
  avoided_foods TEXT[] DEFAULT '{}',
  notification_preferences JSONB NOT NULL DEFAULT '{"daily_workout_reminder": true, "meal_logging_reminder": true, "weekly_progress_summary": false, "goal_milestone_alerts": true}'::jsonb,
  bmr           INTEGER,
  tdee          INTEGER,
  calorie_target INTEGER NOT NULL DEFAULT 2000,
  protein_target_g INTEGER NOT NULL DEFAULT 150,
  carb_target_g INTEGER NOT NULL DEFAULT 200,
  fat_target_g  INTEGER NOT NULL DEFAULT 70,
  water_goal_ml INTEGER,
  onboarded     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS unit_system TEXT NOT NULL DEFAULT 'imperial'
  CHECK (unit_system IN ('imperial', 'metric'));

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS goal_target_change_kg NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS goal_timeframe_weeks INTEGER,
  ADD COLUMN IF NOT EXISTS preferred_workout_time TEXT
  CHECK (preferred_workout_time IN ('early_morning','morning','afternoon','evening','late_night','flexible')),
  ADD COLUMN IF NOT EXISTS preferred_foods TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avoided_foods TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{"daily_workout_reminder": true, "meal_logging_reminder": true, "weekly_progress_summary": false, "goal_milestone_alerts": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS water_goal_ml INTEGER;

-- ─── Meals / Nutrition ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meal_entries (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL,
  meal_type     TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  name          TEXT NOT NULL,
  calories      INTEGER NOT NULL,
  protein_g     NUMERIC(6,1),
  carbs_g       NUMERIC(6,1),
  fat_g         NUMERIC(6,1),
  fiber_g       NUMERIC(6,1),
  notes         TEXT,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_meal_entries_user_date;
CREATE INDEX idx_meal_entries_user_date ON meal_entries(user_id, date);

-- ─── Recipes ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recipes (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  meal_type     TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  prep_time_min INTEGER DEFAULT 0,
  cook_time_min INTEGER DEFAULT 0,
  servings      INTEGER DEFAULT 1,
  instructions  JSONB, -- array of strings
  ingredients   JSONB, -- array of ingredient objects
  macros        JSONB NOT NULL, -- {calories, protein_g, carbs_g, fat_g}
  tags          TEXT[],
  image_url     TEXT,
  is_public     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Weekly Meal Plans ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meal_plans (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  week_start    DATE NOT NULL,
  days          JSONB NOT NULL, -- {monday: {breakfast, lunch, dinner}, ...}
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- ─── Grocery Lists ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS grocery_lists (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  meal_plan_id  UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
  week_start    DATE NOT NULL,
  items         JSONB NOT NULL, -- array of {ingredient, amount, unit, price, category, checked}
  total_cost    NUMERIC(8,2),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- ─── Workout Logs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workout_logs (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  workout_id    TEXT NOT NULL,
  workout_name  TEXT NOT NULL,
  date          DATE NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  duration_min  INTEGER,
  exercises     JSONB NOT NULL, -- array of {exercise_id, exercise_name, sets: [{set_number, target_reps, actual_reps, weight_kg}]}
  notes         TEXT,
  rating        SMALLINT CHECK (rating BETWEEN 1 AND 5),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_workout_logs_user_date;
CREATE INDEX idx_workout_logs_user_date ON workout_logs(user_id, date);

-- ─── Saved Workout Templates ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workout_templates (
  id            TEXT PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  day_label     TEXT NOT NULL DEFAULT '',
  muscle_groups TEXT[] NOT NULL DEFAULT '{}',
  exercises     JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_duration_min INTEGER NOT NULL DEFAULT 0,
  difficulty    TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  split_type    TEXT NOT NULL CHECK (split_type IN ('ppl','upper_lower','3day_fullbody','4day','5day','6day','cardio_focus')),
  source        TEXT NOT NULL DEFAULT 'custom' CHECK (source IN ('custom', 'premade')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_workout_templates_user_updated;
CREATE INDEX idx_workout_templates_user_updated ON workout_templates(user_id, updated_at DESC);

-- ─── Weight Tracking ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS weight_entries (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL,
  weight_kg     NUMERIC(5,2) NOT NULL,
  body_fat_pct  NUMERIC(4,1),
  muscle_mass_kg NUMERIC(5,2),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

DROP INDEX IF EXISTS idx_weight_entries_user_date;
CREATE INDEX idx_weight_entries_user_date ON weight_entries(user_id, date);

-- ─── Water Tracking ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS water_logs (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL,
  amount_ml     INTEGER NOT NULL,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_water_logs_user_logged_at;
CREATE INDEX idx_water_logs_user_logged_at ON water_logs(user_id, logged_at DESC);

-- ─── Journal Entries ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journal_entries (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL,
  title         TEXT,
  content       TEXT NOT NULL,
  mood          SMALLINT NOT NULL CHECK (mood BETWEEN 1 AND 5),
  energy        SMALLINT NOT NULL CHECK (energy BETWEEN 1 AND 5),
  tags          TEXT[],
  workout_log_id UUID REFERENCES workout_logs(id) ON DELETE SET NULL,
  prompts_answered JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP INDEX IF EXISTS idx_journal_entries_user_date;
CREATE INDEX idx_journal_entries_user_date ON journal_entries(user_id, date);

-- ─── Row Level Security (RLS) ────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only read/write their own profile
DROP POLICY IF EXISTS profiles_own ON profiles;
CREATE POLICY profiles_own ON profiles FOR ALL USING (auth.uid() = id);

-- All other tables: users can only access their own data
DROP POLICY IF EXISTS meal_entries_own ON meal_entries;
CREATE POLICY meal_entries_own ON meal_entries FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS recipes_own_or_public ON recipes;
CREATE POLICY recipes_own_or_public ON recipes FOR SELECT USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS recipes_own_write ON recipes;
CREATE POLICY recipes_own_write ON recipes FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS meal_plans_own ON meal_plans;
CREATE POLICY meal_plans_own ON meal_plans FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS grocery_lists_own ON grocery_lists;
CREATE POLICY grocery_lists_own ON grocery_lists FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS workout_logs_own ON workout_logs;
CREATE POLICY workout_logs_own ON workout_logs FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS workout_templates_own ON workout_templates;
CREATE POLICY workout_templates_own ON workout_templates FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS weight_entries_own ON weight_entries;
CREATE POLICY weight_entries_own ON weight_entries FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS water_logs_own ON water_logs;
CREATE POLICY water_logs_own ON water_logs FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS journal_entries_own ON journal_entries;
CREATE POLICY journal_entries_own ON journal_entries FOR ALL USING (auth.uid() = user_id);

-- ─── Auto-update updated_at ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS journal_entries_updated_at ON journal_entries;
CREATE TRIGGER journal_entries_updated_at BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS workout_templates_updated_at ON workout_templates;
CREATE TRIGGER workout_templates_updated_at BEFORE UPDATE ON workout_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Auto-create profile on signup ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, unit_system)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'unit_system', 'imperial')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── User App State (for saved meals, supplements, calendar reminders) ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_app_state (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_meals        JSONB NOT NULL DEFAULT '[]',
  supplements        JSONB NOT NULL DEFAULT '[]',
  calendar_reminders JSONB NOT NULL DEFAULT '[]',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_app_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own app state" ON user_app_state;
CREATE POLICY "Users can read own app state"
  ON user_app_state FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own app state" ON user_app_state;
CREATE POLICY "Users can insert own app state"
  ON user_app_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own app state" ON user_app_state;
CREATE POLICY "Users can update own app state"
  ON user_app_state FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-update updated_at for user_app_state
DROP TRIGGER IF EXISTS user_app_state_updated_at ON user_app_state;
CREATE TRIGGER user_app_state_updated_at BEFORE UPDATE ON user_app_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Push Notifications ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  endpoint      TEXT NOT NULL UNIQUE,
  subscription  JSONB NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_notification_deliveries (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  kind          TEXT NOT NULL,
  dedupe_key    TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, kind, dedupe_key)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_own_read ON push_subscriptions;
CREATE POLICY push_subscriptions_own_read ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_own_insert ON push_subscriptions;
CREATE POLICY push_subscriptions_own_insert ON push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_own_update ON push_subscriptions;
CREATE POLICY push_subscriptions_own_update ON push_subscriptions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_own_delete ON push_subscriptions;
CREATE POLICY push_subscriptions_own_delete ON push_subscriptions FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS push_notification_deliveries_own_read ON push_notification_deliveries;
CREATE POLICY push_notification_deliveries_own_read ON push_notification_deliveries FOR SELECT USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER push_subscriptions_updated_at BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
