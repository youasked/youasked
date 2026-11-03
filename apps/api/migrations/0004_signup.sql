-- Self-serve app creation (`npx youasked init`). One row per app made this way, so we can
-- rate limit by IP and know who to write to.
CREATE TABLE signups (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  ip TEXT NOT NULL,
  email TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX signups_ip ON signups (ip, created_at);
