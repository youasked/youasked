# YouAsked

Feature requests your users can vote on, and a "you asked, it's live" moment when you ship.

- `apps/api`: Hono on Cloudflare Workers + D1. Public widget API (`/v1/*`, publishable key), admin API
  (`/v1/admin/*`, secret key) and a test dashboard at `/admin`.
- `packages/react`: `@youasked/react`, the widget, plus `@youasked/react/server` (`signUser`).

- `packages/cli`: `youasked`, the setup command. `npx youasked init` creates an app, saves the keys and wires up the widget.
- `packages/mcp`: `@youasked/mcp`, an MCP server so a coding agent can list requests, reply, set status and merge.

## Quick start

```sh
npx youasked init
```

Then, to let your agent read and ship requests:

```sh
claude mcp add youasked -e YOUASKED_SECRET_KEY=ya_sec_… -- npx -y @youasked/mcp
```

Commit with "closes YA-12" and the request ships. `POST /v1/signup {name, email?}` is what `init` calls (5 apps per IP per day while in beta).

## Add it to a React app by hand

```tsx
import { YouAsked } from "@youasked/react";

<YouAsked appKey="ya_pub_…" user={{ id: user.id }} signature={signatureFromYourServer} />
```

Sign the user id on your server so nobody can vote as someone else:

```ts
import { signUser } from "@youasked/react/server";
const signature = await signUser(process.env.YOUASKED_SECRET_KEY!, user.id);
```

Leave out `user` for anonymous visitors. `trigger="none"` hides the floating button; open it with
`useYouAsked().open()` or `openYouAsked()`. Colours follow shadcn tokens automatically, or pass `appearance`.

### More ways to ask

- **Show us**: the composer has a "Show us" button. The sheet steps aside, the person drags boxes over what they
  mean on your page, and a screenshot (max 1600px wide, WebP/JPEG) goes with their message. The screenshot library
  loads only when someone taps it. Needs the `UPLOADS` R2 bucket (`wrangler r2 bucket create youasked-uploads`).
  Every request also records the page path (no query string).
- **`<AskAbout topic="charts" prompt="Want more from charts?" />`**: a quiet link next to a feature. Opens the
  composer asking "What would make charts better?" and saves the topic with the request.
- **`<AskForIt query={searchText} />`**: for empty search states, "Can't find “export”? Ask for it". After a locked
  feature, use `openYouAsked({ view: "new", draft: "Export to Excel", topic: "locked" })`.
  `openYouAsked` also takes `topic` and `placeholder`.
- **What's new**: on open (or as a toast on page load), people see what shipped since they were last shown the list,
  with a celebration if it was theirs. Tracked per person on the server (`users.last_whats_new_at`, anonymous
  visitors by device id), only counting things that shipped after their first visit, once per visit.
- **Credit and early access**: identified users with a name can tick "Credit me when it ships" (the ship note then
  says "Thanks to Priya for asking"). Voters on planned or in-progress requests can tap "Try it early"; the
  dashboard lists them.
- **`<YouAsked demo />`**: no `appKey`, no network. Sample requests, working votes, posts and comments, and a pretend
  team that replies a few seconds later. For docs, Storybook and landing pages.

## Develop

```sh
npm install
npm run dev:api                      # wrangler dev, local D1
npm run build                        # builds @youasked/react and @youasked/mcp
npm run typecheck                    # api, react, cli, mcp
```

Create an app: `npx youasked init --api http://localhost:8787`, or `POST /v1/signup`, or `POST /v1/apps` with
`Authorization: Bearer $ADMIN_TOKEN` and `{"name": "..."}`.

## License

The packages under `packages/` (`@youasked/react`, `youasked`, `@youasked/mcp`) are MIT. The hosted API, dashboard and website under `apps/` are [FSL-1.1-MIT](https://fsl.software): you can read, run and self-host them for your own apps, but not offer them as a competing hosted service. Each release becomes MIT two years after it ships. See [LICENSE](LICENSE).
