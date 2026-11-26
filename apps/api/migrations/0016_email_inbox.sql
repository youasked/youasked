-- Email inbox: support email forwarded to <name>-<token>@in.youasked.dev becomes private conversations.
ALTER TABLE apps ADD COLUMN email_inbox INTEGER NOT NULL DEFAULT 0;
ALTER TABLE apps ADD COLUMN email_token TEXT;
-- JSON of the last "confirm forwarding" email caught for this address (Gmail, Outlook, Cloudflare...).
ALTER TABLE apps ADD COLUMN email_setup TEXT;
ALTER TABLE apps ADD COLUMN email_last_at INTEGER;
CREATE UNIQUE INDEX apps_email_token ON apps (email_token);

-- Every email that reached an inbox, for dedupe, threading and the dashboard's "last email" line.
CREATE TABLE inbound_emails (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  request_id TEXT,
  message_id TEXT,
  from_email TEXT,
  subject TEXT,
  status TEXT NOT NULL, -- conversation | reply | setup | dropped | rejected
  reason TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX inbound_emails_msg ON inbound_emails (app_id, message_id);
CREATE INDEX inbound_emails_sender ON inbound_emails (app_id, from_email, created_at);
CREATE INDEX inbound_emails_app ON inbound_emails (app_id, created_at DESC);
