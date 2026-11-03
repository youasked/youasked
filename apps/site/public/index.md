# YouAsked: you asked, it's live

Feature requests that live inside your app, reach you on your phone, and tell everyone who asked the moment you ship. One prompt to install.

## Get started

Paste this into Claude Code, Codex or Cursor:

```
Add YouAsked to this app so people can request features, vote, and hear when they ship.

1. Read https://youasked.adenteo.workers.dev/install.md
2. Run `npx youasked init` and choose entry points that fit this UI: an ask bar on the home screen, a button in the header, or a row in settings.
3. If the app has sign-in, sign each user on the server with signUser from @youasked/react/server, so nobody can vote as someone else.
4. Match our colours with the appearance prop, then show me where each entry point went.
```

Or run `npx youasked init` yourself.

## How it works

1. **They ask, right where they are.** An ask bar, a button or a quiet prompt next to a feature opens a sheet that feels like part of your app. As they type, it finds what others already asked, so one vote replaces ten duplicates.
2. **You hear it on your phone.** Every request lands in Telegram, Slack or Discord with buttons to plan, merge or reply. Your reply reaches everyone who asked, inside the app.
3. **You ship with a commit.** Write "closes YA-12" in a commit or pull request. When it lands, YouAsked marks it shipped and writes the note from your commit. Or let your agent pick the top request and do the whole thing.
4. **Everyone who asked hears about it.** The next time they open your app, a card says what they asked for is live.

## Six ways in

- Ask bar: `<AskBar />`
- Feature card: `<FeatureCard />`
- Buttons: `<RequestButton variant="pill" | "icon" | "row" />`
- Launcher: `<YouAsked trigger="floating" />`
- Whole page: `<FeatureBoard />`
- From your code: `useYouAsked().open({ view: "new", draft: "Export to Excel" })`

All of them follow your colours, font, corners and dark mode (shadcn tokens automatically, or the `appearance` prop).

## For agents

- Install guide: https://youasked.adenteo.workers.dev/install.md
- Claude Code skill: https://youasked.adenteo.workers.dev/skill.md
- MCP server: `claude mcp add youasked -e YOUASKED_SECRET_KEY=ya_sec_… -- npx -y @youasked/mcp`

## Pricing

Free while in beta. Then: Free ($0, 1 app), Maker ($15/month, up to 5 apps, no branding), Studio ($39/month, unlimited apps, team).

## Questions

- **Can a request make an AI change my code?** No. Requests are text people wrote, never instructions. Nothing ships without your commit.
- **What do you get about my users?** Only what you pass: a signed user ID. Email and name are optional; anonymous works too.
- **Platforms?** React and Next.js today; React Native, Swift and Flutter next.
