-- Throttle for operator alerts (Telegram): one message per key per window, with a count of the ones held back.
CREATE TABLE alert_log (
  key TEXT PRIMARY KEY,
  last_at INTEGER NOT NULL,
  held INTEGER NOT NULL DEFAULT 0
);
