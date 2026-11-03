-- Quality: moderation, duplicate dismissals, rate limits, email opt-outs and imported votes.

-- 'off' publishes new requests at once; 'approve' holds them as status 'pending' until the team approves.
ALTER TABLE apps ADD COLUMN moderation TEXT NOT NULL DEFAULT 'off';

-- Votes carried over from another tool have no individual voters, so they are kept as a number
-- that the live vote count adds to (vote_count = imported_votes + COUNT(votes)).
ALTER TABLE requests ADD COLUMN imported_votes INTEGER NOT NULL DEFAULT 0;

-- Pairs the team said are not duplicates. a < b so a pair is stored once.
CREATE TABLE duplicate_dismissals (
  app_id TEXT NOT NULL,
  a TEXT NOT NULL,
  b TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (app_id, a, b)
);

-- Simple hourly counters for spam limits (per IP, per device). Old buckets are swept as they pass.
CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, bucket)
);

-- Unsubscribed from "it shipped" and reply emails (per user, so per app).
ALTER TABLE users ADD COLUMN email_optout INTEGER NOT NULL DEFAULT 0;

-- Each person gets each email once: kind is 'shipped' or 'reply:<comment id>'.
CREATE TABLE email_log (
  request_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (request_id, user_id, kind)
);
