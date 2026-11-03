# @youasked/react

Feature requests your users can vote on, built into your React app. People ask and vote without leaving the app, you hear about it on your phone, and everyone who asked is told when it ships.

Site and live demo: https://youasked.adenteo.workers.dev

## Set up

The quickest way is to run this in your project root. It creates the app, writes the keys and adds the components you pick:

```sh
npx youasked init
```

Or by hand:

```sh
npm i @youasked/react
```

```tsx
"use client";
import { YouAsked } from "@youasked/react";

export function FeatureRequests({ children }: { children: React.ReactNode }) {
  return <YouAsked appKey={process.env.NEXT_PUBLIC_YOUASKED_KEY!}>{children}</YouAsked>;
}
```

`trigger="floating"` (the default) adds a chat bubble in the corner. Use `trigger="none"` and the entry points below if you'd rather place it yourself.

## Entry points

All of them open the same sheet, in your colours, font and dark mode.

| Component | Use it for |
|---|---|
| `<AskBar />` | A chat-style input on a home screen |
| `<FeatureCard />` | Top requests with vote buttons on a dashboard |
| `<RequestButton variant="icon" />` | A round header button, with a badge when something ships |
| `<RequestButton variant="row" />` | A settings row |
| `<RequestButton variant="pill" />` | A tinted pill anywhere |
| `<AskAbout topic="charts" />` | A quiet prompt next to a feature |
| `<AskForIt query={search} />` | An empty search result that offers to ask for it |
| `<FeatureBoard />` | Everything inline, for a `/feedback` page |
| `useYouAsked().open({ view: "new", draft: "Export to Excel" })` | Any button, such as a locked feature |

## Signed-in users

Without this, visitors are anonymous (one ID per device). With sign-in, sign the user ID on your server so nobody can vote as someone else:

```ts
// app/api/youasked/identity/route.ts
import { signUser } from "@youasked/react/server";

export async function GET() {
  const user = await getCurrentUser(); // your auth
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ userId: user.id, signature: await signUser(process.env.YOUASKED_SECRET_KEY!, user.id) });
}
```

Then pass `user={{ id: userId }} signature={signature} ready={loaded}` to `<YouAsked>`. Never put `YOUASKED_SECRET_KEY` in client code.

## Theming

It reads shadcn tokens (`--primary`, `--background`, `--radius` and so on) on its own. Otherwise pass `appearance`:

```tsx
<YouAsked appKey="ya_pub_…" appearance={{ accent: "#5b3df5", radius: 16, fontFamily: "inherit" }} />
```

Dark mode follows the page's `.dark` class or `data-theme`.

## Shipping

Connect Telegram, Slack, Discord or GitHub from the dashboard. A commit with `closes YA-12` on your default branch marks request YA-12 shipped and tells everyone who asked. To let your coding agent read and ship requests, add the MCP server:

```sh
claude mcp add youasked -e YOUASKED_SECRET_KEY=ya_sec_… -- npx -y @youasked/mcp
```

## License

MIT
