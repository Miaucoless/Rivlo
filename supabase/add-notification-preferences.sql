ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL
  DEFAULT '{"daily_workout_reminder": true, "meal_logging_reminder": true, "weekly_progress_summary": false, "goal_milestone_alerts": true}'::jsonb;
