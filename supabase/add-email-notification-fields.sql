ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_notifications_consent_at TIMESTAMPTZ;
