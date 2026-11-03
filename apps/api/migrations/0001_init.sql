CREATE TABLE apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public_key TEXT NOT NULL UNIQUE,
  secret_key TEXT NOT NULL UNIQUE,
  watermark INTEGER NOT NULL DEFAULT 1,
  require_signature INTEGER NOT NULL DEFAULT 1,
  allowed_origins TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  email TEXT,
  name TEXT,
  is_anon INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  UNIQUE (app_id, external_id)
);

CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  vote_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  merged_into TEXT,
  ship_note TEXT,
  shipped_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX requests_app_status ON requests (app_id, status, vote_count DESC);
CREATE INDEX requests_app_created ON requests (app_id, created_at DESC);
CREATE INDEX requests_author ON requests (author_id);

CREATE TABLE votes (
  request_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (request_id, user_id)
);
CREATE INDEX votes_user ON votes (user_id);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  user_id TEXT,
  is_team INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX comments_request ON comments (request_id, created_at);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  seen_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX notifications_user ON notifications (user_id, seen_at);
