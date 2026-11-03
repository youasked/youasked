# YouAsked launch + SEO playbook

Date: 2026-11-03. Research method: ~14 web searches/fetches. **Evidence caveat:** most sources are vendor blogs and aggregators. Search/fetch could not return keyword volumes (no Ahrefs/Semrush access) and I could NOT verify view counts for small indie dev-tool launch tweets. Numbers below are labelled verified / unverified. Verify subreddit rules and HN/PH rules on the primary pages before posting. Nothing was signed up for, posted, or contacted.

---
## 0. Top 10 actions by expected impact

1. **Make youasked.dev crawlable first** (prerender every public route, sitemap, canonical, OG). Everything else (directories, Reddit, AI) links to it. Without it the SPA is a blank shell to many crawlers.
2. **Ship `/alternatives/canny` and `/vs/featurebase` + `/alternatives` hub** (+ UserJot, Frill, Nolt, Upvoty). Competitors own this SERP with listicles; a first-party honest page with a feature table is the cheapest ranking win.
3. **Founder-led X launch with a 30-45s native demo video** of the actual loop (user asks -> upvote -> Telegram ping -> `closes YA-12` -> "you asked, it's live"). Pin it; reply for 48h.
4. **Register the MCP server** in the official MCP registry, Smithery, Glama, mcp.so, and PR to awesome-mcp-servers. The "user feedback mcp" niche is nearly empty and registries are where agents/humans look.
5. **Make the npm package + README the primary GEO asset**: keywords, 5-line quickstart at top, `npx youasked init`, links to docs. Agents read npm/GitHub first.
6. **Show HN** (Tue-Thu, US morning) with a tryable live demo, no landing-page link; stagger from PH by a few days.
7. **"Feedback by YouAsked" badge on free tier + public `/shipped` pages + shareable "you asked, it's live" card** (the product's built-in loop).
8. **Product Hunt launch** (same week, different day than Show HN). Value is mostly badge/backlink/credibility; low-medium traffic for a dev tool.
9. **Seed Reddit with genuinely useful posts** (building-in-public / "how I add feature voting to a Claude Code app") in allowed threads; Reddit is the top Perplexity citation source.
10. **Free tool / template pages** (Feature request template, RICE/vote-score calculator, "feedback widget for React" copy-paste snippets) as link bait and long-tail SEO.

---
## 1. Launch on X

### What the evidence says
- Infrasity's dev-tool X guide (vendor blog, unverified numbers): one native demo video from the founder account, a real result visible in the first ~5 seconds, product usable that same minute; have 10-30 developer creators quote-post within hours; answer technical replies for ~48h; pin the post; company account quote-posts founder. It cites a webAI open-source launch video at 97.5K views (single, unverified example). https://www.infrasity.com/blog/x-twitter-product-launch-developer-tool
- Demo-first pattern: bolt.new's announcement was a ~60s video of an app being built and deployed; a marketing blog credits it with $1M ARR in 7 days (unaudited claim). https://stormy.ai/blog/viral-product-launch-playbook-ai-startups
- DEV Community: a 10-second screen recording of the tool doing its thing beats a blog post. https://dev.to/dev_tips/the-solo-dev-saas-stack-powering-10kmonth-micro-saas-tools-in-2025-pl7
- launcharchive.ai ranks 2026 dev-tool launches by X views (self-reported, unverified): top entries are OpenAI GPT-6 Astra (139M), Grok Build (73M), Perplexity Computer (38.3M, Feb 25 2026), xAI Voice Agent Builder (33M). 10 of the top 12 are **video posts**. These are big-brand launches and are not a benchmark for an indie. https://launcharchive.ai/categories/developer-tools/2026
- Indie Hackers observation: launches get buried; a Sindre Sorhus post about "launch early, learn from feature requests" got ~4.4K views (relevant theme for YouAsked, low reach). https://x.com/sindresorhus/status/1942350242537693508

**Gap, be honest:** I did not find 5-10 verifiable small-indie dev-tool launch tweets with view counts. Action for Aden: in X search, run `"launched" "open source" min_faves:500 filter:native_video since:2026-01-01` plus queries for `feedback widget`, `MCP server`, and `npx` launches, then screenshot 8-10 to study before shooting the video. Common traits that the sources agree on: native video (not a link), result in first seconds, founder voice, product usable immediately, link in a reply (not the main tweet), active replies.

### Recipe for YouAsked
**Video (30-45s, 16:9 or 4:5 for feed, captions burned in, no music needed):**
- 0-4s: hook = the end state. A real app, a user taps "Ask" and types "dark mode", then cut to a Telegram notification on the dev's phone.
- 4-20s: the loop: upvote counter, dev tells Claude Code "ship the top request", commit message `closes YA-12`.
- 20-35s: the payoff: the asker's phone shows "You asked, it's live" card. This is the memorable frame; hold it 3s.
- 35-45s: `npx youasked init` terminal line + "free, open source".
- Motion graphics: keep to simple kinetic-type labels and cursor highlights over REAL screen capture. Avoid abstract animation; the dev audience trusts real product footage. Use the studio's own app as the demo app.

**Founder post structure (text above the video, ~5 lines):**
1. One-line pain: "Users tell vibecoders what they want in DMs and then it's lost."
2. What I built: "YouAsked: an Ask button inside your app. Users vote, you get pinged, `closes YA-12` tells everyone it shipped."
3. Proof: "Set up in one command; your coding agent can read and ship requests (MCP)."
4. Honest context: solo, open source (MIT widget, FSL server), what's rough.
5. CTA: "Try the live demo / repo in reply" (link in first reply; X de-ranks external links in the main post per widely-held practitioner belief, unverified).

**Timing/replies:** Tue-Thu, ~8-10am US Eastern (dev audience overlap). Pin. Reply to every reply for 48h; ask 10-20 builder friends to quote with their own words (genuine use, not scripted); post a follow-up thread 24h later with the architecture/MCP angle and a "first 24h numbers" post (build-in-public posts perform well on IH Build Board). Do not buy engagement.

**Same day as PH/HN?** Sources give no evidence for same-day stacking and warn that PH forbids soliciting upvotes and HN forbids asking for votes. Recommended: X launch day 1 (Tue) -> Show HN day 2-3 -> PH the following Tue/Wed. Each gets its own fresh angle, and replies stay manageable.

---
## 2. Launch channels

| Channel | How | Rules / notes | Expected value |
|---|---|---|---|
| **Show HN** | news.ycombinator.com/submit, title `Show HN: YouAsked - in-app feature requests your coding agent can ship` | Must be something people can try; no landing page/waitlist; link directly to the thing (live demo / repo); don't ask friends to upvote; be in comments for hours; reposts only if significantly different. https://news.ycombinator.com/showhn.html https://news.ycombinator.com/newsguidelines.html | High variance. Front page = thousands of visits + backlinks; 80% of posts do nothing. Best fit: open-source, MCP angle |
| **Product Hunt** | Personal account (no company accounts), schedule up to a month ahead; launches begin 12:01am Pacific; 60-char tagline, 500-char description, 3 tags. Make a maker profile 30 days early, fresh accounts get filtered. Never solicit upvotes. Guides: https://hackmamba.io/developer-marketing/how-to-launch-on-product-hunt/ https://screenhance.com/blog/product-hunt-launch-checklist-2026 | Timing advice conflicts (weekday for traffic vs weekend for easier #1). Unverified. | Medium: badge, backlink, some signups; dev tools underperform consumer on PH |
| **DevHunt** | Submit via GitHub PR; community votes, weekly leaderboard | Dev-tools only; reportedly free dofollow | Medium-low traffic, good fit, cheap |
| **Uneed / Peerlist** | Free launch forms; Peerlist has a builder audience | Daily/weekly rankings | Low-medium; 20 min each |
| **Reddit** | See subreddit table below | Aggregator sources conflict on every rule: verify on each sub's rules page and modmail first. https://okara.ai/blog/subreddits-that-allow-self-promotion | Medium; also feeds GEO |
| **Indie Hackers** | Post + Build Board | Build Board is a daily leaderboard of build-in-public posts; one founder reported $7.5K in 24h (anecdote). https://x.com/IndieHackers/status/1889439045303824635 | Medium; strong audience match |
| **AlternativeTo** | Add as alternative to Canny/Featurebase/UserJot | Strong dev-tools section; needs a free account | Medium-high for "alternative" queries and AI citations |
| **SaaSHub, StackShare, Console.dev** | Submit listing; Console.dev is a curated newsletter, ~1-2 weeks review | I found nothing verified on SaaSHub rules. https://saascity.io/blog/best-directories-developer-tools-2026 | Low-medium, backlinks |
| **There's An AI For That** | Submit form (paid placement likely) | Not verified; the product is AI-adjacent only via MCP. Skip unless free | Low |
| **MCP: official registry** | Publish to npm with `mcpName`, then `mcp-publisher init -> validate -> login (GitHub or DNS) -> publish`; registry stores metadata only, public packages only. https://modelcontextprotocol.info/tools/registry/publishing/ https://www.stackone.com/blog/mcp-registry-how-to-get-listed/ | Verify tap/formula name in registry repo | High for the MCP angle |
| **MCP: Smithery, Glama, mcp.so, awesome-mcp-servers** | Submission steps not confirmed by my searches; each has a GitHub-connect or form flow | Check each site's current docs | Medium-high, cheap |
| **awesome-selfhosted** | PR per CONTRIBUTING.md | Requires free software; FSL is NOT OSI-free, so likely rejected or marked non-free (inference, check). Also needs active maintenance. https://mintlify.com/awesome-selfhosted/awesome-selfhosted/getting-started/contributing | Probably not eligible. Consider a Cloudflare-Workers self-host guide first |
| **awesome-react / awesome-mcp-servers** | PR to list | Not verified by my searches; read each CONTRIBUTING | awesome-mcp-servers: medium-high; awesome-react: low-medium |

### Subreddits (all unverified aggregator data; read the live rules)
- r/SideProject: project posts welcome; sources disagree on rules. Good first post. 
- r/reactjs: promotions belong in showcase/feedback threads; demos need source code. Open source repo helps.
- r/nextjs: mod permission or weekly showoff thread.
- r/ClaudeAI: rules recently rewritten; show projects in a way that teaches (e.g. "I let Claude Code ship my users' feature requests").
- r/vibecoding: "no shilling" rule; dev tools may need approval.
- r/webdev: Showoff Saturday only.
Pattern: lead with a story/learning, open-source link, no signup-wall, one sub per day, reply to all comments, never cross-post identical text.

---
## 3. SEO

### SERP landscape (verified from search results)
- "Canny alternatives" is a crowded listicle SERP: Zonka, TheCXLead, BuildBetter, UserVoice, ProductBridge, Perspective, PlanetRoadmap, RightFeature, Featurask, PLGOS, UserOrbit. Competitors write for themselves and name themselves #1. https://www.zonkafeedback.com/blog/canny-alternatives-and-competitors https://uservoice.com/blog/canny-alternatives https://productbridge.io/blog/canny-alternatives
- Featurebase runs a `/blog/comparisons` hub with many "Canny vs X" pages and cross-links them, and even "Featurebase alternatives" listicles by third parties (eesel, ProductBridge, Quickhunt). https://www.featurebase.app/blog/comparisons
- Pricing context from guides: Featurebase from ~$29/seat/mo, Frill ~$25/mo, Upvoty ~$15/mo; Canny no longer has a meaningful free tier (per guides, unverified). That is YouAsked's wedge: generous free tier, open source, agent-native.

### Keywords (volume/difficulty NOT obtained; priority by intent and my judgement; confirm in Ahrefs/Semrush or Google Keyword Planner free)
| Keyword | Intent | Competition (judgement) | Plan |
|---|---|---|---|
| canny alternative(s) | comparison | High (listicles + Featurebase) | `/alternatives/canny` |
| featurebase alternative | comparison | Medium | `/alternatives/featurebase` |
| userjot alternative, frill alternative, nolt alternative, upvoty alternative | comparison | Low-medium | one page each |
| feature request widget / feature voting board | product | Medium | `/feature-request-widget`, `/feature-voting-board` |
| react feedback widget / in-app feedback react | dev | Low-medium | `/docs/react` + `/react-feedback-widget` |
| feature request tool for startups / indie | product | Medium | `/for/indie-hackers`, `/for/vibecoders` |
| public roadmap tool, changelog widget | product | Medium-high | later; only after roadmap/changelog features exist |
| user feedback mcp / mcp feedback server | emerging | Very low | `/mcp` page + blog; own it |
| feature request template / how to prioritise feature requests | informational | Medium | free templates + blog |
| how to add feature requests to react app | how-to / GEO | Low | blog + docs |

### Page plan (build order)
**Phase 1 (launch week):**
1. `/` home (with "what is it" paragraph, 3-step loop, install command, FAQ with FAQPage schema).
2. `/docs` (quickstart, React widget, GitHub `closes` keyword, Telegram/Slack/Discord, MCP, self-host) as static, one URL per topic.
3. `/mcp` (what the MCP server does, tool list, copy-paste config for Claude Code/Cursor/Codex).
4. `/alternatives/canny`, `/vs/featurebase`, `/alternatives` hub.
5. `/pricing`, `/changelog`, `/shipped` (public demo of the loop).
6. `/llms.txt`, `/llms-full.txt`, `/sitemap.xml`, `/robots.txt`.

**Phase 2 (weeks 2-6):** `/vs/userjot`, `/vs/frill`, `/vs/nolt`, `/vs/upvoty`, `/react-feedback-widget`, `/feature-request-widget`, `/for/vibecoders`, `/for/indie-hackers`, `/integrations/github|telegram|slack|discord`.

**Phase 3 (blog + free tools):** 
- "How to add feature requests to a React / Next.js / Vite app in 5 minutes"
- "I let Claude Code ship my users' feature requests" (story post, also for HN/Reddit)
- "Feature request template" + "How to prioritise requests when you have 20 users"
- "What is a vibecoder feedback loop"
- Free tools: feature-request template generator, vote-based prioritisation calculator, "paste your URL -> generate embed snippet".
Honesty rule for comparison pages: accurate pricing with dates, fair "choose them if..." sections; thin or false claims get disliked by AI engines and users.

### Technical SEO for the Vite SPA
- A pure client-rendered SPA is weak for crawling and for AI crawlers that do not execute JS. Prerender at build. Options from search: vite-ssg (React variant: `vite-react-ssg`), vite-plugin-prerender, react-snap (unmaintained), or a custom build-time prerender step using `react-dom/server` over a route list (a July 2026 post describes this for ~280 routes: https://dev.to/feed/virdix — verify). Simplest robust path: **move marketing pages to Astro** (or Next.js static export) on the same Cloudflare project, keep the app/widget in Vite. Recommendation: Astro for `youasked.dev`; it gives per-page HTML, MDX docs and blog natively.
- Per page: unique `<title>` (<60 chars), meta description, one H1, canonical to `https://youasked.dev/...` (set up redirect from workers.dev to the custom domain; `noindex` the workers.dev host).
- Sitemap.xml with lastmod, referenced in robots.txt; submit in Google Search Console and Bing Webmaster Tools (Bing feeds ChatGPT search and Copilot).
- OG/Twitter images per page (1200x630), generated at build.
- Structured data JSON-LD: `SoftwareApplication` (home), `FAQPage` (home, alternatives), `BreadcrumbList` (docs), `TechArticle` (docs), `Article` (blog), `Organization` + `sameAs` (GitHub, npm, X).
- Core Web Vitals: ship zero JS on content pages; fonts self-hosted.
- Robots: allow GPTBot, OAI-SearchBot, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot. Per one guide, blocking ClaudeBot does not block Claude citation traffic, and Claude-Web is retired. https://aidev.com/guides/how-to-get-cited-by-chatgpt-claude-perplexity

---
## 4. AI visibility (GEO)

### What evidence supports
- **llms.txt:** weak evidence of effect. SE Ranking (~300K domains, Nov 2025): ~10% adoption, no measurable link to AI citations. Ahrefs reportedly found most llms.txt files get no crawler requests; server logs from ~900 domains showed no verified frontier-lab crawler requests; Google said (June 2026) it neither helps nor harms. https://www.searchenginejournal.com/llms-txt-shows-no-clear-effect-on-ai-citations-based-on-300k-domains/561542/ https://www.digitalapplied.com/blog/llms-txt-in-practice-adoption-evidence-2026 **Still ship it** (30 min, and coding agents given a docs URL do read it), but do not expect it to move recommendations; docs quality does.
- **Where citations come from (vendor-reported, indicative):** Reddit is reported at ~46.7% of Perplexity top citations; official docs next; ChatGPT leans on Wikipedia/editorial, landing pages (23.8%) and how-to pages (19.4%) of its top 1,000 cited pages (Ahrefs via guide); Claude cites 2-3 tight primary sources. https://www.tooljunction.io/guides/get-cited-by-chatgpt-perplexity https://dev.to/studio1hq/how-to-get-your-tool-recommended-by-chatgpt-perplexity-and-google
- Freshness favoured; clear answer in the first paragraph; third-party mentions on trusted sites.

### Actions
1. Homepage and docs first paragraph answers exactly: "YouAsked is an open-source in-app feature request widget for React that your coding agent can read and ship." Repeat the phrase verbatim on npm, GitHub, docs, directories (consistent entity description).
2. A docs page titled "How to add feature requests to a React app" with copy-paste code; the same for Next.js, Vite, Expo/React Native if supported.
3. GitHub: README top = one-liner + install + GIF; topics: `feature-requests`, `feedback-widget`, `react`, `mcp`, `mcp-server`, `claude-code`, `nextjs`, `canny-alternative`; license badge; a `CLAUDE.md`/`AGENTS.md` snippet users can paste; releases with notes.
4. npm: keywords mirror above; `mcpName` in package.json; homepage -> youasked.dev; README identical quickstart.
5. MCP registries (section 2) = how agents discover it.
6. Claude Code skill published in its own repo with a README and a docs page; add to skill/plugin directories.
7. Reddit and Stack Overflow: answer "how do I collect feature requests in my app" questions with honest, disclosed help; never astroturf. Quality threads become citations.
8. AlternativeTo, SaaSHub, G2/Capterra-style listings (editorial third-party mentions).
9. Measure: weekly script asks ChatGPT/Claude/Perplexity 20 target questions and logs mentions (Aden already has an AI-visibility tracker script for other apps; reuse it). Track per query: mentioned, position, cited URL.

---
## 5. Growth loops in the product

Evidence is thin and mostly marketing-blog claims (unverified): Calendly "Powered by" badge on free plans (claimed 25% of signups, unsourced); Loom watermark (claimed 30% of organic signups, unsourced); Lovable's "Edit with Lovable" badge hidden on paid plans; one company turned its badge into an affiliate link. https://founderpath.com/blog/powered-by-virality
The mechanic is real and well-known; the figures are not trustworthy, so instrument it yourself.

Recommended loops (in order):
1. **Badge on free tier** ("Feedback by YouAsked", links to `youasked.dev/?ref=<appslug>`), removable on paid; optional "ref" credit for devs who keep it. The widget is in front of end users who are themselves builders (vibecoders), a good audience.
2. **"You asked, it's live" card**: when a request ships, each asker gets an in-app moment and a share card (OG image of the request title + app name + "shipped via YouAsked"). The shipping dev can one-click post it to X ("Shipped YA-12: dark mode, asked by 14 users"). Makes build-in-public content nearly free, with a link back.
3. **Public `/shipped` page per app** (`app.youasked.dev/<slug>/shipped`), indexable, with FAQ/Software schema; each is an SEO page for the app and a backlink to YouAsked.
4. **Agent loop:** `npx youasked init` writes AGENTS.md/CLAUDE.md lines that mention YouAsked and the `closes YA-n` convention, so every repo that adopts it teaches future agents (and repo viewers) about it.
5. **Commit/PR bot comment** "Shipped 14 requests via YouAsked" with link, opt-in.
6. **Dogfood:** YouAsked on youasked.dev itself with a public board; shows social proof and creates early content.
Instrument first: `ref` param, signup-by-source, badge impression/click counts.

---
## 6. Suggested 3-week calendar
- Week -1: prerender site, alternatives pages, docs, llms.txt, registries (MCP official + Smithery + Glama + mcp.so), npm/GitHub polish, record video, collect 10-20 real early users for replies.
- Day 1 (Tue): X launch + IH post + Uneed/Peerlist/DevHunt.
- Day 2-3: Show HN (tryable demo link), r/SideProject + r/ClaudeAI story post.
- Day 4-7: AlternativeTo, directories, awesome-mcp-servers PR, first blog post, follow-up X thread with numbers.
- Week 2: Product Hunt (Tue/Wed), r/reactjs/r/nextjs showcase threads, ship Phase 2 comparison pages.
- Week 3+: free tools, weekly GEO check, publish "N requests shipped" updates.

## Sources index
Infrasity X guide; launcharchive.ai; stormy.ai; HN showhn.html and guidelines; hackmamba / screenhance PH guides; okara.ai subreddit rules; SearchEngineJournal llms.txt study; digitalapplied llms.txt; tooljunction + aidev + dev.to GEO guides; featurebase.app comparisons; zonkafeedback/uservoice/productbridge Canny alternatives; saascity directories; modelcontextprotocol.info + stackone MCP registry; mintlify awesome-selfhosted contributing; founderpath powered-by virality (URLs inline above).
