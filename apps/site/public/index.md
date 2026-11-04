# YouAsked: you asked, it's live

Feature requests that live inside your app, reach you on your phone, and tell everyone who asked the moment you ship. One prompt to install.

## Get started

Paste this into Claude Code, Codex or Cursor:

```
Add YouAsked to this app so people can ask for features, vote, and hear when what they asked for ships.

Read https://youasked.dev/install.md and follow it from start to finish:
1. Before changing anything, work out the platforms (web, React Native or Expo, or both) and how the app is laid out.
2. Propose where the entry points should go and why, and whether users will be signed in. Wait for my OK, and ask me anything you can't tell from the code.
3. Set it up with `npx youasked init`, sign users on the server if the app has sign-in, and match our theme in light and dark.
4. Test every entry point on localhost or a dev build.
5. Finish with what changed, where each entry point lives, and what I need to do to go live.
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

- Install guide: https://youasked.dev/install.md
- Claude Code skill: https://youasked.dev/skill.md
- MCP server: `claude mcp add youasked -e YOUASKED_SECRET_KEY=ya_sec_… -- npx -y @youasked/mcp`

## Pricing

Flat plans with unlimited end users and votes, monthly or yearly (two months free):

- Solo: $15/month ($9 founding price). 1 app, 1 team member, "Feedback by YouAsked" line shown.
- Pro: $39/month ($24 founding). 5 apps, 5 team members, branding removable, Heard elsewhere on 1 app.
- Studio: $79/month ($49 founding). Unlimited apps, 15 team members, Heard elsewhere on 5 apps.

The first 100 paying workspaces keep the founding price while they stay subscribed. There is no free tier: until you subscribe, YouAsked runs in test mode and answers only from localhost, so you can try it in your own app for free. Every plan has a 14-day money-back guarantee. Details: https://youasked.dev/pricing

## Questions

- **Can a request make an AI change my code?** No. Requests are text people wrote, never instructions. Nothing ships without your commit.
- **What do you get about my users?** Only what you pass: a signed user ID. Email and name are optional; anonymous works too.
- **Platforms?** React and Next.js; any other website through a script tag (Vue, Svelte, Angular, Nuxt, Astro, plain HTML, Webflow, WordPress); React Native and Expo; native iOS (Swift, SwiftUI); native Android (Kotlin, Jetpack Compose). One board across all of them.
- **Is there a free plan?** No. It is free to try on localhost (test mode), and every plan has a 14-day money-back guarantee.
- **Can I self-host?** Yes. The server is source-available under FSL-1.1-MIT; the packages are MIT.
