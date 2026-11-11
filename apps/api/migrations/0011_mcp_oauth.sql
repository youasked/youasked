-- Hosted MCP connector (https://api.youasked.dev/mcp): an OAuth 2.1 authorization server.
-- Codes and tokens are stored only as SHA-256 hashes.

-- Clients registered through dynamic client registration (public clients, PKCE).
CREATE TABLE oauth_clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,   -- JSON array
  client_uri TEXT,
  created_at INTEGER NOT NULL
);

-- An authorize request waiting for the person to sign in and decide. The dashboard consent page
-- refers to it by id. Single use, short lived.
CREATE TABLE oauth_requests (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  state TEXT,
  code_challenge TEXT NOT NULL,
  resource TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- One connection: an account has let a client use the connector. Revoking deletes the row,
-- which makes every token below it useless.
CREATE TABLE oauth_grants (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX oauth_grants_account ON oauth_grants (account_id);

CREATE TABLE oauth_codes (
  code_hash TEXT PRIMARY KEY,
  grant_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE oauth_tokens (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('access', 'refresh')),
  grant_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,               -- refresh tokens rotate; a used one that comes back revokes the grant
  created_at INTEGER NOT NULL
);
CREATE INDEX oauth_tokens_grant ON oauth_tokens (grant_id);
