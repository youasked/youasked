# Launch build: shared contract

Several agents build the launch features in parallel, each in its own git worktree. This file is
the contract between them. Read it fully before starting, and read `docs/launch-plan.md` for the why.

## Domains

| Host | What | Code |
|---|---|---|
| `youasked.dev` (+ `www`) | Marketing site, SEO pages, public boards at `youasked.dev/<slug>` | `apps/site` (worker `youasked`) |
| `api.youasked.dev` | API, webhooks, OAuth callbacks | `apps/api` (worker `youasked-api`) |
| `app.youasked.dev` | Dashboard for developers | `apps/dashboard` (new, worker `youasked-dashboard`) |

The old `*.adenteo.workers.dev` hosts keep working for installs that already point at them.

## Product decisions (made by Aden, don't relitigate)

- **No free tier and no trial.** Instead:
  - **Test mode:** an app whose workspace has no live subscription answers widget requests only from local origins (`isLocalOrigin` in `apps/api/src/plans.ts`). Developers install and try it in their own app for free.
  - **Money-back guarantee:** 14 days, no questions. This is copy only; refunds are done by hand in Stripe.
- **Plans:** Solo, Pro and Studio, monthly or yearly at 2 months free. Founding prices are locked for the first 100 paying workspaces. Prices and limits live in `apps/api/src/plans.ts` and nowhere else.
- **Votes:** plain upvotes only, never weighted by revenue.
- **Branding:** the "Feedback by YouAsked" line shows on Solo and can be removed on Pro and Studio. The column `apps.watermark` already exists.
- **Telegram:**
  - Default: the shared bot `@youasked_bot` (one-tap connect).
  - Bring your own bot: the existing `PUT /v1/admin/integrations/telegram` flow, which must keep working.
  - Notify-only mode: also stays.

## Foundation (already on master)

- **`migrations/0005_accounts_billing.sql`:** `accounts` (developers; not `users`, who are an app's end users), `account_identities`, `sessions`, `login_tokens`, `workspaces` (holds billing), `members`, `invites`, and new columns `apps.workspace_id` and `apps.claim_token`.
- **`src/plans.ts`:** `PLANS`, `PRICES`, `FOUNDING_SLOTS`, `lookupKey()`, `isLive()`, `isLocalOrigin()`, `entitlements(env, app)`.
- **`src/types.ts`:** the `Env` fields for every secret and binding below. Every new one is optional, so local dev runs without it.

Migration numbers are reserved per stream so they never clash:

| Stream | Migration |
|---|---|
| accounts | 0005, done |
| quality | 0006 |
| public | 0007 |
| agents | 0008 |
| dashboard, react-native | none |

## How the API is organised (important for merging)

- **App-scoped features go on the admin router** (`/v1/admin/...`). It authenticates with the app's secret key and gives you the app as `c.get("app")`. The MCP server and CLI use these routes too. Put each stream's routes in its own file (for example `src/quality.ts` exporting a Hono router) and mount it with **one line** in `index.ts`, next to `app.route("/v1/admin", agent)`.
- **The dashboard reaches the same routes as `/v1/dash/apps/:appId/<admin path>`.** The accounts stream adds a session-authenticated proxy that checks the signed-in account is a member of the app's workspace, sets `c.get("app")`, and dispatches into the admin router. So feature streams never deal with sessions; they just add admin routes.
- **Workspace-level routes** (account, workspaces, billing, team, creating apps) are `/v1/dash/...`, owned by the accounts stream.
- **Public read-only routes** for boards are `/v1/public/...`, owned by the public stream. No key is needed; only apps that turned their public board on are served.
- **Webhooks** are `/v1/hooks/...` (stripe, telegram-shared, github already exists).

Keep the existing code style: Hono, raw D1 SQL with `prepare/bind`, small files, plain-English comments only where they explain why, ids from `newId()` in `src/lib.ts`, times in epoch milliseconds.

## API contract the dashboard builds against

The `dashboard` stream builds against these shapes. Streams that own them must match, or note the difference in their report. All JSON. Sessions use an HttpOnly cookie `ya_session`, `Domain=.youasked.dev` in production, and the dashboard sends `credentials: "include"`.

**Auth (accounts stream)**
- `GET /v1/auth/providers` returns `{ google: bool, github: bool, email: bool }`.
- `GET /v1/auth/google/start?next=/path` redirects to Google, and `GET /v1/auth/google/callback` sets the cookie and redirects to `DASHBOARD_URL + next`. GitHub works the same way.
- `POST /v1/auth/email {email, next}` sends a sign-in link, and `GET /v1/auth/email/verify?token=…&next=…` sets the cookie and redirects.
- `POST /v1/auth/logout`.

**Workspaces (accounts stream)**
- `GET /v1/dash/me` returns `{ account: {id,email,name,avatarUrl}, workspaces: [{id,name,role,plan,live}] }`, or 401.
- `POST /v1/dash/workspaces {name}` returns `{ workspace }`. Every account gets one automatically on first sign-in.
- `GET /v1/dash/workspaces/:wid` returns `{ workspace: {id,name,plan,interval,status,live,founding,currentPeriodEnd}, limits, usage: {apps,members}, members: [{accountId,email,name,role}], invites: [...], apps: [{id,name,publicKey,live,createdAt}], foundingLeft }`.
- `POST /v1/dash/workspaces/:wid/apps {name}` returns `{ app: {id,name,publicKey,secretKey} }`. The secret key is shown once; later reads mask it. Plan limits are enforced (402 `{error, upgrade:true}`).
- `POST /v1/dash/apps/:appId/rotate-secret` returns `{ secretKey }`.
- `POST /v1/dash/claim {claimToken | secretKey, workspaceId}` returns `{ app }`. It moves an unclaimed app (from `npx youasked init`) into a workspace.
- `POST /v1/dash/workspaces/:wid/invites {email, role}`, `POST /v1/dash/invites/:id/accept`, `DELETE /v1/dash/workspaces/:wid/members/:accountId`.
- `POST /v1/dash/workspaces/:wid/checkout {plan, interval}` returns `{ url }` (Stripe Checkout). `POST /v1/dash/workspaces/:wid/portal` returns `{ url }` (Stripe billing portal).

**App, through `/v1/dash/apps/:appId/...` (admin routes)**
- **Existing:**
  - `GET/PATCH /app`
  - `GET /requests?status=`, `GET/PATCH/DELETE /requests/:id`
  - `POST /requests/:id/comments {body}`, `POST /requests/:id/merge {into}`
  - `GET /integrations`, `PUT /integrations/telegram|github|webhook`, `DELETE /integrations/:kind`
  - from `agent.ts`: `GET /lookup?ref=YA-12`, `GET /search?q=`, `GET /digest`
- **quality stream:**
  - `GET /duplicates` returns `{ pairs: [{a: request, b: request, score}] }`, and `POST /duplicates/dismiss {a,b}`.
  - Moderation: `PATCH /app {moderation: "off" | "approve"}`. Requests waiting for approval have status `pending`, and `GET /requests?status=pending` lists them. `POST /requests/:id/approve` and `POST /requests/:id/reject`.
  - Import and export: `POST /import` (multipart: `file`, `source` = `canny` | `featurebase` | `csv`) returns `{ imported, skipped }`. `GET /export?format=csv|json` downloads.
- **public stream:**
  - `PATCH /app {slug, publicBoard: bool, description}`.
  - `GET /app` also returns `slug`, `publicBoard`, `publicUrl`.
  - Shipped requests get `shareUrl` (a page) and `shareImage` (a PNG).
- **agents stream:**
  - `POST /integrations/telegram/connect` returns `{ link, code }` (a `t.me/youasked_bot?startgroup=<code>` deep link). `GET /integrations` shows it once connected.
  - `PUT /integrations/github-token {token, repo}` stores the token encrypted with `TOKEN_ENC_KEY`.
  - `POST /requests/:id/build` returns `{ prompt, issueUrl? }`. It opens a GitHub issue when a token is connected.
  - `GET/PUT /listening/config {keywords: [], competitors: [{name, appStoreId?, playId?}], subreddits: []}`.
  - `GET /listening/inbox` returns `{ items: [{id, source, url, text, feature, strength, createdAt, matchedRequest?}] }`, and `POST /listening/inbox/:id/approve|dismiss|merge {requestId?}`.

## Secrets and bindings (Claude sets them; never hard-code, print or commit a key)

`GOOGLE_*`, `GITHUB_*`, `STRIPE_*`, `YOUASKED_BOT_*`, `TOKEN_ENC_KEY` and `SCRAPECREATORS_API_KEY` are Worker secrets in production and `.dev.vars` locally (gitignored). The `AI`, `VECTORIZE` and `EMAIL` bindings go in `wrangler.jsonc`. Code must degrade gracefully when one is missing:
- no AI: fall back to text matching
- no EMAIL: log instead of sending
- no Stripe key: return 503 from the billing routes

Before coding against Cloudflare Email Sending, Vectorize, Workers AI or Stripe, fetch current docs with the `ctx7` CLI (`npx ctx7@latest library <name> "<question>"`, then `docs`). These APIs change.

## Rules for every stream

- Work only in your worktree and branch. Don't deploy, don't run remote D1 migrations, don't run `npm publish`, don't push, and don't touch production secrets. Test locally (`wrangler dev --local`, `wrangler d1 migrations apply youasked --local`).
- Stay inside your scope. If you need something from another stream, write it down under "Needs from others" in your report instead of building it.
- Before you finish:
  - `npm run typecheck` passes.
  - Your feature has been exercised end to end locally: curl and a headless-Chrome screenshot for UI, with puppeteer-core at `/Users/adenteo/otay-landing/node_modules/` and Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
  - You've committed on your branch with the message ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Report back:
  - what you built
  - new routes, tables, secrets and bindings
  - what you tested and how
  - anything unfinished
  - "Needs from others"
- UI work: match the quality bar of `apps/site` and `packages/react`. It should be clean, calm and premium, in light and dark, and work on a phone. Use plain sentence-case copy that names things by what users understand.
