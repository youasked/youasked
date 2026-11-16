-- Private mode: each person sees only their own conversations with the team, never anyone else's
-- requests, votes or comments. The team sees everything in the dashboard and replies one person at a time.
ALTER TABLE apps ADD COLUMN private_mode INTEGER NOT NULL DEFAULT 0;

-- Stamped when the request was written while the app was private. It stays author-only for good,
-- even if the app later turns its public board back on.
ALTER TABLE requests ADD COLUMN private INTEGER NOT NULL DEFAULT 0;

-- A private conversation the team filed under another request (several people asked for the same
-- thing). Each person keeps their own conversation; it follows the linked request's status, so
-- everyone is told in their own thread when it ships. Merging would show them someone else's words.
ALTER TABLE requests ADD COLUMN linked_to TEXT;
CREATE INDEX requests_linked ON requests (linked_to) WHERE linked_to IS NOT NULL;

-- The team marked the conversation done. Cleared when the person writes again.
ALTER TABLE requests ADD COLUMN closed_at INTEGER;
