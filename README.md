# YouAsked

Feature requests your users can vote on, and a "you asked, it's live" moment when you ship.

- `apps/api`: Hono on Cloudflare Workers + D1. Public widget API (`/v1/*`, publishable key), admin API
  (`/v1/admin/*`, secret key) and a test dashboard at `/admin`.
- `packages/react`: `@youasked/react`, the widget, plus `@youasked/react/server` (`signUser`).

## Add it to a React app

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
npm run build                        # builds @youasked/react
```

Create an app: `POST /v1/apps` with `Authorization: Bearer $ADMIN_TOKEN` and `{"name": "..."}`.
