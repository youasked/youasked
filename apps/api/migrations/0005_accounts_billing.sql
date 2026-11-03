-- Dashboard accounts (the developers who own apps). Not the same as `users`, who are the people
-- using an app and asking for things.
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL
);

-- One row per way an account signs in: ('google', sub), ('github', id), ('email', address).
CREATE TABLE account_identities (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  account_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX account_identities_account ON account_identities (account_id);

-- id is the SHA-256 of the cookie value, so a database leak doesn't leak sessions.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_account ON sessions (account_id);

-- Email sign-in links. id is the SHA-256 of the token in the link.
CREATE TABLE login_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

-- Billing lives on the workspace. plan is NULL until the first payment; an app whose workspace
-- has no live subscription runs in test mode (localhost only).
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT,
  billing_interval TEXT,
  subscription_status TEXT,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  founding INTEGER NOT NULL DEFAULT 0,
  current_period_end INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE members (
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, account_id)
);
CREATE INDEX members_account ON members (account_id);

CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  accepted_at INTEGER
);
CREATE INDEX invites_workspace ON invites (workspace_id);

-- Apps made by `npx youasked init` start unclaimed (workspace_id NULL) with a claim token the CLI
-- prints; opening the claim link signs in and moves the app into a workspace.
ALTER TABLE apps ADD COLUMN workspace_id TEXT;
ALTER TABLE apps ADD COLUMN claim_token TEXT;
CREATE INDEX apps_workspace ON apps (workspace_id);
