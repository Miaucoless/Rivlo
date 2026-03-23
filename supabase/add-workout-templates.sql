CREATE TABLE IF NOT EXISTS workout_templates (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  day_label TEXT NOT NULL DEFAULT '',
  muscle_groups TEXT[] NOT NULL DEFAULT '{}',
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_duration_min INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  split_type TEXT NOT NULL CHECK (split_type IN ('ppl','upper_lower','3day_fullbody','4day','5day','6day','cardio_focus')),
  source TEXT NOT NULL DEFAULT 'custom' CHECK (source IN ('custom', 'premade')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_templates_user_updated
  ON workout_templates(user_id, updated_at DESC);

ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workout_templates_own" ON workout_templates;
CREATE POLICY "workout_templates_own"
  ON workout_templates
  FOR ALL
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS workout_templates_updated_at ON workout_templates;
CREATE TRIGGER workout_templates_updated_at
  BEFORE UPDATE ON workout_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
