-- ============================================================
-- Grays Fitness — Supabase Database Schema
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
  gender        TEXT NOT NULL DEFAULT 'male' CHECK (gender IN ('male', 'female', 'other')),
  activity_level TEXT NOT NULL DEFAULT 'moderately_active'
    CHECK (activity_level IN ('sedentary','lightly_active','moderately_active','very_active','extra_active')),
  fitness_goal  TEXT NOT NULL DEFAULT 'fat_loss'
    CHECK (fitness_goal IN ('fat_loss','muscle_gain','maintenance','athletic_performance')),
  workout_split TEXT NOT NULL DEFAULT 'ppl'
    CHECK (workout_split IN ('ppl','upper_lower','3day_fullbody','4day','5day','6day','cardio_focus')),
  bmr           INTEGER,
  tdee          INTEGER,
  calorie_target INTEGER NOT NULL DEFAULT 2000,
  protein_target_g INTEGER NOT NULL DEFAULT 150,
  carb_target_g INTEGER NOT NULL DEFAULT 200,
  fat_target_g  INTEGER NOT NULL DEFAULT 70,
  onboarded     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE INDEX idx_workout_logs_user_date ON workout_logs(user_id, date);

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

CREATE INDEX idx_weight_entries_user_date ON weight_entries(user_id, date);

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

CREATE INDEX idx_journal_entries_user_date ON journal_entries(user_id, date);

-- ─── Row Level Security (RLS) ────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only read/write their own profile
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);

-- All other tables: users can only access their own data
CREATE POLICY "meal_entries_own" ON meal_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "recipes_own_or_public" ON recipes FOR SELECT USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "recipes_own_write" ON recipes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "meal_plans_own" ON meal_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "grocery_lists_own" ON grocery_lists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "workout_logs_own" ON workout_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "weight_entries_own" ON weight_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "journal_entries_own" ON journal_entries FOR ALL USING (auth.uid() = user_id);

-- ─── Auto-update updated_at ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER journal_entries_updated_at BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Auto-create profile on signup ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
