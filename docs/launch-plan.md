# YouAsked: plan to launch

YouAsked can win the indie and vibecoder corner of feature-request tools. No competitor has the in-app sheet with several entry points, two-way replies, shipping from a commit, and a one-command setup an agent can run. This plan covers pricing, the features to build before launch, SEO and the launch itself. Decisions for Aden are at the end.

Research behind this: `docs/research/competitors.md` (21 tools, prices seen 2026-11-03) and `docs/research/launch-seo.md`.

## Where we stand

| | |
|---|---|
| Live | API, React widget, CLI and MCP on npm, landing page (pre-rendered for crawlers), public GitHub repo |
| Waiting on Aden | Cloudflare sign-in to buy youasked.dev; a Stripe account for YouAsked |
| Not built | Accounts and a real dashboard, billing, public roadmap pages, the features below |

## The competition in one table

| Tool | Free tier | Paid, per month | What people dislike |
|---|---|---|---|
| Canny | 25 tracked users | $19 to $79+, rises with tracked users (about $1,079 at 5,000) | Pay per tracked user, surprise upgrades |
| Featurebase | 1 seat | $29 / $59 / $99 per seat, AI $0.49 per resolution | Per-seat plus metered AI, hard to predict |
| UserJot | 2 boards | $29 / $59 | |
| Frill | No | $25 / $49 / $149 / $349 | |
| Nolt | No | $29 / $69 | |
| Upvoty | No | $15 / $25 / $49 | |
| Sleekplan | Yes | $13 / $38 (yearly) | |
| FeedBear | No | $19 / $49 / $99 / $299 | |
| WishKit | Yes | $15 | Has iOS SDK |
| Quackback (open source) | Yes | $29 / $59 / $99 | MCP from $29 |
| Fider (open source) | 250 items | $25 | Basic |

Common complaints across the category:
1. Pricing that grows with users or seats.
2. Widgets that send people to a hosted portal or an iframe instead of staying in the app.
3. No mobile SDKs. Only WishKit (iOS) and a couple of tiny tools have one, and nobody has React Native.
4. Weak loop-closing: people rarely hear back.

**MCP is not unique any more.** Featurebase, Canny, Quackback and a few others have shipped MCP servers. Our edge is the whole loop: ask in the app, hear it on your phone, ship from a commit, and everyone who asked hears about it. On top of that come the one-command install and React Native.

## Positioning

**Feature requests that feel built into your app, and tell people when you ship.**

For indie devs and people building with Claude Code, Codex or Cursor. Flat price, unlimited users and votes, one command or one prompt to set up.

## Pricing (proposal)

No permanent free tier. Free users cost real money here (AI, screenshots, notifications), and the two biggest competitors have been shrinking theirs.

| | Solo | Pro | Studio |
|---|---|---|---|
| Monthly | $15 | $39 | $79 |
| Yearly (2 months free) | $150 | $390 | $790 |
| **Founding price, locked for life** | **$9 / $90** | **$24 / $240** | **$49 / $490** |
| Apps | 1 | 5 | Unlimited |
| Team members | 1 | 5 | 15 |
| End users and votes | Unlimited | Unlimited | Unlimited |
| Every entry point, Telegram, Slack, Discord, GitHub, MCP | Yes | Yes | Yes |
| Public roadmap and changelog page | Yes | Yes | Yes |
| "Feedback by YouAsked" line in the sheet | Shown | Removable | Removable |
| AI duplicate merging and weekly AI digest | Yes | Yes | Yes |
| Heard elsewhere (App Store reviews, Reddit) | | 1 app | 5 apps |
| Linear sync, custom domain | | Yes | Yes |

- **Trial:** 14 days, no card, everything on. When it ends the board goes read-only and the data is kept for 60 days.
- **Founding price:** the first 100 workspaces keep the founding price for as long as they stay subscribed. That's simpler and safer than a lifetime deal.
- **Free paths that don't cost us:** self-hosting (the server is source-available) and free Pro for open-source projects on request.
- **Should it be free for a while?** Only as a closed beta: about 20 hand-picked developers, free for 2 to 3 weeks before launch, in return for feedback and a quote we can use. They get the founding price when they convert. A public free period would bring in people who leave when pricing starts.

## Features to build before launch

### Must have (launch blockers)

1. **Accounts and a real dashboard.** Email sign-in link, workspaces, several apps, team invites, and request management (status, merge, reply, ship). Today's `/admin` asks for a pasted secret key.
2. **Billing.** Stripe Checkout with monthly and yearly prices, the trial, the founding coupon, a billing portal, and plan limits enforced by a webhook.
3. **Public board, roadmap and changelog per app** at `youasked.dev/<app>`. Search engines can find these, people share them, and they are the "shipped" page.
4. **Smarter duplicate catching.** Match by meaning, not words, as people type ("export to Excel" finds "download a spreadsheet"), and suggest merges to the team. Uses Cloudflare's own AI, so it's cheap.
5. **Spam and moderation.** Filters, rate limits, and an optional "approve before it goes public" switch.
6. **A YouAsked Telegram bot** with one-tap connect, so any developer gets the buttons in ten seconds. Sheldon stays notify-only.
7. **Email when it ships,** for people who left an email, so the loop closes even when they don't open the app.
8. **Import from Canny, Featurebase and CSV, and export.** Switching has to be easy.

### Differentiators (the things the launch video shows)

9. **React Native and Expo SDK.** No competitor has one. Graiden's Android app is the first user.
10. **"Build it" for agents.** One tap in Telegram or the dashboard turns a request into a GitHub issue with a spec, ready for Claude Code or Codex. The MCP server gets a `next` tool that returns the best request to build next. When the commit lands, everyone who asked is told.
11. **Share cards.** Every shipped request gets a "You asked, it's live" image and page that users and developers can post.
12. **Heard elsewhere.** Weekly scan of your app's and competitors' App Store reviews and Reddit for feature requests, and AI triage into an inbox you approve. The test run on 2026-11-03 found real leads for about $0.30 of AI. X was too thin to be worth paying for.

### After launch

Linear sync, custom domains, SwiftUI and Flutter SDKs, SSO.

## SEO

The landing page is now pre-rendered, with a sitemap, social preview image and structured data. Next pages, in order:

1. **Launch week:** `/docs`, `/pricing`, `/changelog`, `/mcp`, `/alternatives` with `/alternatives/canny` and `/vs/featurebase`, and the public boards.
2. **Weeks 2 to 6:** vs pages for UserJot, Frill, Nolt and Upvoty; `/react-feedback-widget`; `/feature-request-widget`; `/for/vibecoders`; one page per integration.
3. **Later:** blog posts ("Add feature requests to a React app in 5 minutes", "I let Claude Code ship my users' requests"), and free tools such as a feature-request template and a vote-prioritisation calculator.

AI visibility: list the MCP server in the official MCP registry, Smithery, Glama and mcp.so, open PRs to awesome-mcp-servers and awesome-react, and keep the npm README and GitHub README sharp, because those are what AI assistants read. One study of about 300,000 sites found llms.txt made no measurable difference, but it costs nothing to keep.

Keyword volumes still need checking in a keyword tool before we write the comparison pages.

## Launch

1. **Closed beta** of about 20 developers for 2 to 3 weeks, with Graiden as the first real app.
2. **X launch, Tuesday to Thursday, 8 to 10am US Eastern.**
   - **Video:** a 30 to 45 second motion-graphics demo, built in code (Remotion), so there's no AI video spend. Open on the Telegram ping, show ask, vote and `closes YA-12`, hold on the "you asked, it's live" card, and end on `npx youasked init`.
   - **Your post:** why you built it (Graiden users asked for things and never heard back), what it does, one command to set up, open source. Put the link in the first reply. Pin it and answer replies for 48 hours.
3. **Show HN** 2 to 3 days later, with the live demo and the repo.
4. **Product Hunt** the week after.
5. **Directories and lists:** MCP registries, DevHunt, Uneed, Peerlist, AlternativeTo, SaaSHub.
6. **Reddit:** r/SideProject, r/reactjs, r/nextjs, r/ClaudeAI, r/vibecoding. Check each subreddit's own rules first.

## Decisions for Aden

1. **Pricing:** Solo $15, Pro $39, Studio $79 (founding $9 / $24 / $49), 14-day no-card trial, no free tier. Change any numbers?
2. **"Feedback by YouAsked" line on Solo:** keep it (a free growth loop), or remove it on every paid plan?
3. **Features:** build all 12 before launch, or launch with 1 to 8 plus 9 and 10, and ship 11 and 12 in the first two weeks after launch?
4. **Closed beta:** yes or no, and who to invite besides Graiden.
