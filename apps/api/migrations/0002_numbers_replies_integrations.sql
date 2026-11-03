-- Human request numbers (YA-12) so commits, PRs and chat can refer to them.
ALTER TABLE requests ADD COLUMN number INTEGER;
UPDATE requests SET number = (
  SELECT COUNT(*) FROM requests r2
  WHERE r2.app_id = requests.app_id
    AND (r2.created_at < requests.created_at OR (r2.created_at = requests.created_at AND r2.id <= requests.id))
);
CREATE UNIQUE INDEX requests_app_number ON requests (app_id, number);

-- Team replies notify the people who asked; the notice points at the comment.
ALTER TABLE notifications ADD COLUMN comment_id TEXT;

-- Telegram, GitHub and webhook connections, one of each kind per app.
CREATE TABLE integrations (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  config TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (app_id, kind)
);

-- Which Telegram message is about which request, and what a reply to it means.
CREATE TABLE telegram_messages (
  chat_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  request_id TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'card',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (chat_id, message_id)
);
