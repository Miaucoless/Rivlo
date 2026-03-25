-- Migration: move savedMeals, supplements, calendarReminders from user metadata to a proper table
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS user_app_state (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_meals        JSONB NOT NULL DEFAULT '[]',
  supplements        JSONB NOT NULL DEFAULT '[]',
  calendar_reminders JSONB NOT NULL DEFAULT '[]',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_app_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own app state"
  ON user_app_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own app state"
  ON user_app_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own app state"
  ON user_app_state FOR UPDATE
  USING (auth.uid() = user_id);
