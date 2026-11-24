-- Signed webhooks to an app's own server (integration kind 'events'). Every event sent to a person
-- is one row here: it holds the exact body that was signed, so retries and "Resend" send the same
-- bytes, and the dashboard shows it in the delivery log. Rows older than 30 days are pruned daily.
CREATE TABLE event_deliveries (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  last_code INTEGER,
  last_error TEXT,
  next_at INTEGER,
  created_at INTEGER NOT NULL,
  delivered_at INTEGER
);
CREATE INDEX event_deliveries_due ON event_deliveries (status, next_at);
CREATE INDEX event_deliveries_app ON event_deliveries (app_id, created_at);
