-- Public boards: an app can opt in to a page at youasked.dev/<slug> that shows its top requests,
-- roadmap and changelog. Shipped requests get a share page at youasked.dev/<slug>/shipped/<n>
-- whether or not the board itself is public.
ALTER TABLE apps ADD COLUMN slug TEXT;
ALTER TABLE apps ADD COLUMN public_board INTEGER NOT NULL DEFAULT 0;
ALTER TABLE apps ADD COLUMN description TEXT;
CREATE UNIQUE INDEX apps_slug ON apps (slug) WHERE slug IS NOT NULL;
-- The changelog reads shipped requests by date.
CREATE INDEX requests_app_shipped ON requests (app_id, shipped_at DESC) WHERE status = 'shipped';
