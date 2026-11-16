# Claude Connectors Directory listing (claude.ai/directory)

Everything to enter in the developer portal, so the listing can be rebuilt or edited later.
No reviewer password is stored in this repo.

## Connection
- Server URL: `https://api.youasked.dev/mcp` (one URL for everyone)
- Transport: Streamable HTTP, stateless JSON-RPC (initialize, tools/list, tools/call, ping)
- Users connect to different URLs: no (universal URL). That keeps it a Community listing with no Verified-only restriction.

## Listing
- Name: YouAsked (portal limit 100 characters)
- URL slug: `youasked` (permanent once published, so pick it carefully)
- One-liner (200 characters or fewer): Read the feature requests your users send from inside your app, reply, merge duplicates and mark them shipped, all from a Claude chat.
  (134 characters)
- Categories: Productivity, Developer tools (the portal takes one to five; use the closest options)
- Documentation URL: https://youasked.dev/mcp
- Privacy policy URL: https://youasked.dev/privacy#ai-assistants (new section "AI assistants (MCP connector)" added to the privacy page)
- Terms URL: https://youasked.dev/terms
- Support contact: hello@youasked.dev (there is no separate support page; the site menu's Contact link is this address)
- Icon: `brand/connector-icon-512.png` (512x512 PNG of the YouAsked mark on a light background, made from `brand/icon.svg`). The docs state no size or format rule for the icon, so this is a safe square raster; the vector is `apps/site/public/icon.svg`.

Description (2000 characters or fewer):

YouAsked is feature requests and feedback that live inside your app. People ask for what they want, vote on it, and get told when you ship it. This connector puts that inbox in your Claude chat.

Ask Claude what your users want most and it lists the open requests by votes, with the YA number, status, vote count and comments. Ask it to read one in full, find similar requests before you reply, or pick the best thing to build next with a short reason. It can write a ready-to-use build brief for a request, with what people said in their own words and the commit line that closes it.

When you want to answer people, Claude can post a reply as your team, move a request to planned, in progress, shipped or declined, and merge duplicates so their votes add up. Marking a request shipped tells everyone who asked or voted, once, so Claude only does it when you ask.

Some apps run in private mode, where each person only sees their own conversation with your team. There Claude can list the conversations waiting for your reply, draft answers for you to approve, and reply to one person or to everyone linked to the same request. Merging links private conversations instead, and each person is told when the linked request ships.

You sign in with your YouAsked account and approve the connection once. It works with every app in the workspaces you belong to; with more than one app, Claude asks which, or you name it. You can see and disconnect the connection any time under AI assistants in the YouAsked dashboard.

Claude cannot see your secret keys, billing or payment details, change app settings or integrations, manage your team, delete requests or apps, or see the email addresses of the people who asked. Request text is written by your users, so the connector marks it as data and tells Claude never to treat it as instructions.

(1837 characters)

## Use cases
- A developer asks "what are my users asking for this week?" and gets a digest of top asks, new requests and what shipped.
- "What should I build next?" returns the best request with a reason, then a build brief to work from.
- Triage in one message: "Find duplicates of the dark mode request, merge them, and reply to the people who asked that it is planned."
- After shipping, "Mark YA-12 shipped with the note: Find it in Settings, then Appearance." tells everyone who asked.
- In an app running private mode: "Which conversations need a reply?" lists them, then "Draft replies and I will tell you which to send" so the owner approves each one before it goes to that person.
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

In private-mode apps the same ten tools behave differently: `reply` reaches only the one person (or everyone linked, when asked), `list_requests` takes a `needs_reply` filter, and `merge` links conversations instead of merging them. Names, titles, annotations and tool count do not change, so nothing here needs re-entering. Re-check the tool descriptions in the portal's Tools step after the private-mode release is deployed.

Read tools carry end-user text (request titles, bodies, comments); every result says to treat it as data.

## Company
- YouAsked, https://youasked.dev, contact hello@youasked.dev (run by Aden Teo, Singapore)

## Authentication
- Required. OAuth 2.1 served by YouAsked itself (api.youasked.dev), no Anthropic-held client needed.
  - Authorization code with PKCE (S256 only), dynamic client registration (public clients, token endpoint auth method `none`), rotating refresh tokens, revocation endpoint.
  - Metadata: `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource` (both also under the `/mcp` suffix). Unauthenticated calls to `/mcp` return 401 with `WWW-Authenticate: Bearer resource_metadata="https://api.youasked.dev/.well-known/oauth-protected-resource/mcp"`.
  - Claude requires `https://claude.ai/api/mcp/auth_callback` for the hosted apps and a port-agnostic loopback redirect (`http://localhost/callback`, `http://127.0.0.1/callback`) for Claude Code. Claude uses DCR here (it uses CIMD only if the metadata advertises it, which ours does not). Callbacks work for `https://claude.ai/api/mcp/auth_callback`, `https://claude.com/api/mcp/auth_callback` and localhost redirects (Claude Code, MCP Inspector). Redirect URIs must be https, loopback http or an app scheme.
  - Sign-in and consent reuse the YouAsked dashboard account (Google, GitHub or email link). The consent page names the client, says what it can and cannot do, and has Allow / Not now.
  - Tokens are opaque random values stored only as SHA-256 hashes. Access tokens last 1 hour, refresh tokens 60 days and rotate on every use; a replayed code or refresh token revokes the connection. Tokens are bound to the `/mcp` resource and are rejected by every other API route.
  - Access is checked on every call against the person's current workspace membership.
  - Rate limit: 600 tool calls per connection per hour.

- Portal "How users authenticate": Authentication requirement = Always required; method = OAuth sign-in with Dynamic Client Registration (do not enter Anthropic-held client credentials, there is no client secret).
- Claude's OAuth endpoints time out after 10 seconds (30 for refresh) and Anthropic's traffic comes from 160.79.104.0/21; the API is on Cloudflare with no WAF rule blocking it.

## Data handling
- Underlying API: our own first-party API (the MCP domain matches the service). No personal health data, no sponsored content. Cloudflare Workers and D1. Privacy: https://youasked.dev/privacy#ai-assistants

## Test and launch

The portal's Test & launch step only asks you to confirm you ran every tool (MCP Inspector or as a custom connector in Claude). It says not to put credentials in the portal. For a Community listing no test account is needed. If the listing is escalated to Verified review, a reviewer emails hello@youasked.dev asking for test access: reply then with the reviewer account details (never store them in this repo). Instructions to send in that email, after Aden has done the steps in "What Aden does by hand" below:

1. Add `https://api.youasked.dev/mcp` as a custom connector and choose Connect.
2. On the YouAsked sign-in page choose "Sign in with a password" and use the reviewer email and password (sent in the email).
3. Read the consent screen and choose Allow.
4. The account owns two demo apps with fictional data. "Orbit Habits (demo)" is a public board with seven requests, votes and comments (dark mode and dark theme duplicates, a CSV export, an offline mode in progress, a shipped reminder, a declined one). "Orbit Support (demo)" is in private mode with four one-to-one conversations: three waiting on a reply, and two people asking for the same export, linked. No real people can be contacted: the demo users have no email addresses.
5. Try: "Which YouAsked apps do I have?", "Which conversations in Orbit Support need a reply?", "Reply to everyone who asked for the Excel export in Orbit Support: it's planned for next month", "What are Orbit Habits users asking for?", "Show me YA-5 in full", "Search for dark theme requests", "Merge YA-2 into YA-1", "Reply to YA-4: Thanks, we are looking at a widget", "Mark YA-3 shipped with the note: Find it in Settings, then Export", "What should I build next?"
6. To disconnect: dashboard, AI assistants, Disconnect (https://app.youasked.dev/assistants).

## Compliance step
Seven acknowledgments, all required: directory guidelines, first-party API usage (true), financial transactions (none), AI media generation (none), prompt injection (tool results are marked as data), conversation data collection (none beyond tool arguments), public documentation (https://youasked.dev/mcp). Also accept the Anthropic Software Directory Terms and Policy (Aden does this himself).

## Documentation
https://youasked.dev/mcp is public and covers setup. Keep example prompts on that page (the portal's use cases above double as usage examples). After private mode ships, make sure the page mentions it.

## Allowed link URIs
Optional, and only used by tools that call `ui/open-link` (ours do not; the connector has no UI), so this can be left empty. If entered, each must be an origin you own:
- https://youasked.dev
- https://app.youasked.dev

## Status and what's left (2026-11-16)

Done: private mode and this listing are deployed (API, dashboard, site); the reviewer demo account `reviewer@youasked.dev` is seeded in production with both demo apps (`node apps/api/scripts/seed-demo.mjs --email reviewer@youasked.dev --private`, rerun to reset after a review).

Left, in order:
1. Turn on the reviewer password sign-in (Aden, in his own Terminal): create `~/.config/youasked/reviewer.env` with `REVIEW_LOGIN_EMAIL=reviewer@youasked.dev` and a random `REVIEW_LOGIN_PASSWORD`, then set the Worker secrets `REVIEW_LOGIN_EMAIL` and `REVIEW_LOGIN_HASH` (SHA-256 hex of the password) with `npx wrangler secret put`. The sign-in page shows "Sign in with a password" once both are set.
2. Dry run: in claude.ai, Settings, Connectors, add a custom connector with the server URL, sign in as the reviewer, and run each tool once from the prompts above.
3. Open https://claude.ai/directory/manage (any paid Claude plan), Submit new, MCP connector, and fill each step from this file. Accept the directory terms and the seven compliance boxes yourself. Check the Tools step shows no missing title or annotation warnings.
4. If the portal's test tool reports 403 forbidden_origin, add its origin to the allow-list in `apps/api/src/mcp.ts` (now claude.ai, claude.com, anthropic.com, chatgpt.com, youasked.dev, localhost).
