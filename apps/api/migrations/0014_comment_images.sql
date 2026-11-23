-- Images on team replies. They live in the same R2 bucket and uploads table as the screenshots on
-- requests; comment_id says which reply they belong to. request_id is set too once they're attached
-- (so the abandoned-upload sweep and "delete this request" treat them like any other file), and
-- request attachments leave out anything with a comment_id.
ALTER TABLE uploads ADD COLUMN comment_id TEXT;
CREATE INDEX uploads_comment ON uploads (comment_id);
