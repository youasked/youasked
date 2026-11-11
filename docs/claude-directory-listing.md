# Claude Connectors Directory listing (claude.ai/directory)

Everything to enter in the developer portal, so the listing can be rebuilt or edited later.
No reviewer password is stored in this repo.

## Connection
- Server URL: `https://api.youasked.dev/mcp` (one URL for everyone)
- Transport: Streamable HTTP, stateless JSON-RPC (initialize, tools/list, tools/call, ping)

## Listing
- Name: YouAsked
- One-liner (200 characters or fewer): Read the feature requests your users send from inside your app, reply, merge duplicates and mark them shipped, all from a Claude chat.
  (134 characters)
- Categories: Productivity, Developer tools (use the portal's closest options)
- Documentation URL: https://youasked.dev/mcp
- Privacy policy URL: https://youasked.dev/privacy#ai-assistants (new section "AI assistants (MCP connector)" added to the privacy page)
- Terms URL: https://youasked.dev/terms
- Support contact: hello@youasked.dev (there is no separate support page; the site menu's Contact link is this address)
- Icon: `apps/site/public/icon.svg` (export a 512x512 PNG from `brand/` if the portal wants a raster, for example `brand/apple-touch-icon.png`)

Description (2000 characters or fewer):

YouAsked is feature requests and feedback that live inside your app. People ask for what they want, vote on it, and get told when you ship it. This connector puts that inbox in your Claude chat.

Ask Claude what your users want most and it lists the open requests by votes, with the YA number, status, vote count and comments. Ask it to read one in full, find similar requests before you reply, or pick the best thing to build next with a short reason. It can write a ready-to-use build brief for a request, with what people said in their own words and the commit line that closes it.

When you want to answer people, Claude can post a reply as your team, move a request to planned, in progress, shipped or declined, and merge duplicates so their votes add up. Marking a request shipped tells everyone who asked or voted, once, so Claude only does it when you ask.

You sign in with your YouAsked account and approve the connection once. It works with every app in the workspaces you belong to; with more than one app, Claude asks which, or you name it. You can see and disconnect the connection any time under AI assistants in the YouAsked dashboard.

Claude cannot see your secret keys, billing or payment details, change app settings or integrations, manage your team, delete requests or apps, or see the email addresses of the people who asked. Request text is written by your users, so the connector marks it as data and tells Claude never to treat it as instructions.

## Use cases
- A developer asks "what are my users asking for this week?" and gets a digest of top asks, new requests and what shipped.
- "What should I build next?" returns the best request with a reason, then a build brief to work from.
- Triage in one message: "Find duplicates of the dark mode request, merge them, and reply to the people who asked that it is planned."
- After shipping, "Mark YA-12 shipped with the note: Find it in Settings, then Appearance." tells everyone who asked.
- Users need: a free YouAsked account with at least one app.
- Reads and writes data.

## Tools (all take an optional `app`, an id or name, except list_apps)
| Tool | Title | Read only | Destructive | Idempotent | Open world | Why |
|---|---|---|---|---|---|---|
| list_apps | List my apps | yes | no | yes | no | |
| list_requests | List feature requests | yes | no | yes | no | |
| get_request | Get one feature request | yes | no | yes | no | |
| next_request | What to build next | yes | no | yes | no | |
| search | Find similar requests | yes | no | yes | no | |
| digest | Digest of top asks and recent activity | yes | no | yes | no | |
| build_prompt | Get a build prompt for a request | no | no | yes | yes | Can open a GitHub issue once (asking again reuses it) |
| reply | Reply to the people who asked | no | no | no | yes | Adds a message and notifies the askers; cannot be unsent |
| set_status | Change a request's status | no | yes | yes | yes | Overwrites the status and ship note; shipped sends notices that cannot be recalled |
| merge | Merge a duplicate | no | yes | yes | no | The duplicate leaves the board and is not split back out here |

Read tools carry end-user text (request titles, bodies, comments); every result says to treat it as data.

## Company
- YouAsked, https://youasked.dev, contact hello@youasked.dev (run by Aden Teo, Singapore)

## Authentication
- Required. OAuth 2.1 served by YouAsked itself (api.youasked.dev), no Anthropic-held client needed.
  - Authorization code with PKCE (S256 only), dynamic client registration (public clients, token endpoint auth method `none`), rotating refresh tokens, revocation endpoint.
  - Metadata: `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource` (both also under the `/mcp` suffix). Unauthenticated calls to `/mcp` return 401 with `WWW-Authenticate: Bearer resource_metadata="https://api.youasked.dev/.well-known/oauth-protected-resource/mcp"`.
  - Callbacks work for `https://claude.ai/api/mcp/auth_callback`, `https://claude.com/api/mcp/auth_callback` and localhost redirects (Claude Code, MCP Inspector). Redirect URIs must be https, loopback http or an app scheme.
  - Sign-in and consent reuse the YouAsked dashboard account (Google, GitHub or email link). The consent page names the client, says what it can and cannot do, and has Allow / Not now.
  - Tokens are opaque random values stored only as SHA-256 hashes. Access tokens last 1 hour, refresh tokens 60 days and rotate on every use; a replayed code or refresh token revokes the connection. Tokens are bound to the `/mcp` resource and are rejected by every other API route.
  - Access is checked on every call against the person's current workspace membership.
  - Rate limit: 600 tool calls per connection per hour.

## Data handling
- Our own API on Cloudflare Workers and D1. No health data. No sponsored content. Privacy: https://youasked.dev/privacy#ai-assistants

## Test and launch (reviewer instructions)

Paste into the portal's reviewer field, after Aden has done the steps in "What Aden does by hand" below:

1. Add `https://api.youasked.dev/mcp` as a custom connector and choose Connect.
2. On the YouAsked sign-in page choose "Continue with Google" and sign in with the reviewer account given in the portal (<REVIEWER EMAIL>, password in the portal).
3. Read the consent screen and choose Allow.
4. The account owns one demo app, "Orbit Habits (demo)", with seven fictional requests, votes and comments (dark mode and dark theme duplicates, a CSV export, an offline mode in progress, a shipped reminder, a declined one). No real people can be contacted: the demo users have no email addresses.
5. Try: "Which YouAsked apps do I have?", "What are my users asking for?", "Show me YA-5 in full", "Search for dark theme requests", "Merge YA-2 into YA-1", "Reply to YA-4: Thanks, we are looking at a widget", "Mark YA-3 shipped with the note: Find it in Settings, then Export", "What should I build next?"
6. To disconnect: dashboard, AI assistants, Disconnect (https://app.youasked.dev/assistants).

## Allowed link URIs
- https://youasked.dev
- https://app.youasked.dev

## What Aden does by hand before submitting

Nothing below has been done. No account was created and nothing was run against production.

1. Merge the branch, then deploy: `npm run deploy:api` applies migration `0011_mcp_oauth.sql` to the remote D1 and deploys the Worker; deploy the dashboard (it has the new /connect and /assistants pages) and the site (MCP page, docs, privacy section).
2. Make the reviewer sign-in work. Simplest safe path: create a new Google account used only for review (for example `youasked.reviewer@gmail.com`), and put its password in the portal (not in this repo). Google sign-in is in production, so "Continue with Google" works. Alternative if Google challenges a new login from another country: route `reviewer@youasked.dev` to a mailbox the reviewer can read and use the email-link sign-in. There is deliberately no password login to add.
3. Seed the demo data (prints SQL only, safe to rerun, replaces the demo rows):
   ```sh
   node apps/api/scripts/seed-demo.mjs --email youasked.reviewer@gmail.com > /tmp/seed.sql
   cd apps/api && npx wrangler d1 execute youasked --remote --file /tmp/seed.sql
   ```
   The account is matched by email, so the first Google sign-in with that address lands on it with the demo workspace and app. Sign in once yourself to confirm the dashboard shows "Orbit Habits (demo)", then rerun the seed after the reviewer is done to reset the data.
4. Dry run: add the connector in your own claude.ai (Settings, Connectors, Add custom connector), connect, and run the prompts above. Also try `claude mcp add --transport http youasked https://api.youasked.dev/mcp` and `/mcp`.
5. Fill in the portal from this file (icon as a PNG, reviewer account details, the reviewer instructions above with the email filled in).
6. Check the `Origin` allow-list in `apps/api/src/mcp.ts` (claude.ai, claude.com, anthropic.com, chatgpt.com, youasked.dev, localhost) covers whatever the portal's test tool uses; add it if the review tool reports a 403 forbidden_origin.
