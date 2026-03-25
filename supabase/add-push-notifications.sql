-- Push notification subscription + delivery dedupe tables
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
