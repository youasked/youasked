-- Agents stream: shared Telegram bot connect codes, "Build it" GitHub issues, and Heard elsewhere.

-- One-time codes behind t.me/youasked_bot?start=<code>. Short-lived; a code is used once.
CREATE TABLE telegram_connect_codes (
  code TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX telegram_connect_codes_app ON telegram_connect_codes (app_id);

-- The GitHub issue opened for a request, so "Build it" reuses it.
ALTER TABLE requests ADD COLUMN issue_url TEXT;

-- Where a request came from when it was not typed in the widget, and how many outside mentions it has.
ALTER TABLE requests ADD COLUMN source TEXT;
ALTER TABLE requests ADD COLUMN source_url TEXT;
ALTER TABLE requests ADD COLUMN elsewhere_count INTEGER NOT NULL DEFAULT 0;

-- Heard elsewhere settings, one row per app. JSON arrays in the text columns.
CREATE TABLE listening_config (
  app_id TEXT PRIMARY KEY,
  keywords TEXT NOT NULL DEFAULT '[]',
  competitors TEXT NOT NULL DEFAULT '[]',   -- [{name, appStoreId?, playId?}]
  subreddits TEXT NOT NULL DEFAULT '[]',
  countries TEXT NOT NULL DEFAULT '["us"]',
  about TEXT NOT NULL DEFAULT '',            -- one or two sentences on what the app does, for the relevance check
  app_store_id TEXT,                         -- this app's own App Store id
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,
  updated_at INTEGER NOT NULL
);

-- Everything the daily run has looked at. status: new (in the inbox), approved, merged, dismissed,
-- or ignored (checked and not a feature request; kept only so it is not checked again).
CREATE TABLE listening_items (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  source TEXT NOT NULL,                     -- reddit | appstore
  url TEXT NOT NULL,
  text TEXT NOT NULL,
  author TEXT,
  feature TEXT,
  strength INTEGER NOT NULL DEFAULT 1,
  matched_request_id TEXT,
  request_id TEXT,                          -- the request an approved/merged item ended up in
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL,
  UNIQUE (app_id, url)
);
CREATE INDEX listening_items_inbox ON listening_items (app_id, status, strength DESC, created_at DESC);
