-- Add XP state column to user_app_state for the Rivora rank/XP system
ALTER TABLE user_app_state
  ADD COLUMN IF NOT EXISTS xp JSONB NOT NULL DEFAULT '{}'::jsonb;
