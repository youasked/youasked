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

## Develop

```sh
npm install
npm run dev:api                      # wrangler dev, local D1
npm run build                        # builds @youasked/react and @youasked/mcp
npm run typecheck                    # api, react, cli, mcp
```

Create an app: `npx youasked init --api http://localhost:8787`, or `POST /v1/signup`, or `POST /v1/apps` with
`Authorization: Bearer $ADMIN_TOKEN` and `{"name": "..."}`.
