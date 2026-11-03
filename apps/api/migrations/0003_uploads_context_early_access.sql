-- Where a request came from: JSON {"path": "/pricing", "topic": "charts"}. Both optional.
ALTER TABLE requests ADD COLUMN context TEXT;

-- "Credit me when it ships": the author opted in to being thanked by first name.
ALTER TABLE requests ADD COLUMN credit INTEGER NOT NULL DEFAULT 0;

-- Screenshots live in R2 (UPLOADS); this row says whose they are and which request they belong to.
-- request_id stays NULL between the upload and the request being posted.
CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  request_id TEXT,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX uploads_request ON uploads (request_id);
CREATE INDEX uploads_user ON uploads (user_id, created_at);

-- Voters who'd like to try a planned or in-progress request before it ships.
CREATE TABLE early_access (
  request_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (request_id, user_id)
);

-- When this person was last shown "what shipped since you were here". Separate from last_seen_at,
-- which only moves hourly and on any request.
ALTER TABLE users ADD COLUMN last_whats_new_at INTEGER;
