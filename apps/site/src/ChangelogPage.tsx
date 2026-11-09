import { Callout, PageHead, Prose } from "./Page";

type Entry = { date: string; title: string; body: string; tags: string[] };

// Newest first. Static for now: see the note at the bottom of the page.
export const ENTRIES: Entry[] = [
  {
    date: "2026-11-07",
    title: "“Show us” stays clear of your tab bar",
    body: "The bars you use while showing us something now sit above your app's bottom bar, using the same offset as the launcher. Drag either bar anywhere if it covers something you need, and the bar fades while you draw a box. In @youasked/react 0.7.4 and @youasked/js 0.1.3.",
    tags: ["Improved", "Web"],
  },
  {
    date: "2026-11-06",
    title: "“Show us” scrolls on phones",
    body: "On a phone, the page now scrolls while you go to what you want to show, instead of staying stuck where the sheet was opened. In @youasked/react 0.7.3 and @youasked/js 0.1.2.",
    tags: ["Fixed", "Web"],
  },
  {
    date: "2026-11-05",
    title: "Hand a request to Copilot, Claude or Cursor",
    body: "Build it now sends a request straight to a coding agent. Assign it to GitHub Copilot's coding agent, ask @claude on the GitHub issue for the Claude Code GitHub Action, or open Cursor with the prompt filled in. Copilot and @claude are buttons in Telegram too. The agent opens a pull request, and merging it ships the request and tells everyone who asked.",
    tags: ["New", "Agents"],
  },
  {
    date: "2026-11-05",
    title: "“Show us” lets you go to the right screen first",
    body: "Tapping “Show us” now puts a small bar over your app instead of freezing the page: go to the screen, scroll or open the menu you mean, then tap Capture and circle it. The widget also ignores your site's own element styles (section, list, heading and input rules), so it looks the same on any page.",
    tags: ["Improved", "Web"],
  },
  {
    date: "2026-11-09",
    title: "Lower prices, a site menu and plainer plan descriptions",
    body: "Solo is now $9 a month, Pro $18 and Studio $39 (founding prices $6, $12 and $24), and yearly is still four months free. Every plan bullet now says in one line what it does, the comparison table explains each row, and the site has a menu on phones and desktop that jumps straight to pricing, docs, FAQ and contact.",
    tags: ["Pricing", "Web"],
  },
  {
    date: "2026-11-05",
    title: "Yearly is now four months free",
    body: "Yearly plans cost about a third less than paying monthly. The pricing shows what you're billed each year and what you save.",
    tags: ["Pricing"],
  },
  {
    date: "2026-11-04",
    title: "Native iOS and Android, and any website",
    body: "YouAsked now has a SwiftUI SDK for iOS (Swift Package Manager), a Jetpack Compose SDK for Android (JitPack), and @youasked/js for websites that aren't React: Vue, Svelte, Angular, Nuxt, Astro, plain HTML and no-code builders, as a script tag or ES module. Same sheet, votes, in-app notices and occasional prompt everywhere, on one board. npx youasked init picks the right one.",
    tags: ["New", "iOS", "Android", "Web"],
  },
  {
    date: "2026-11-04",
    title: "Button corners, separately from cards",
    body: "appearance now takes buttonRadius for buttons, the ask bar, the composer and chips: a number, any CSS length, or \"pill\". radius keeps shaping cards, rows and the sheet. Both work in React and React Native (@youasked/react 0.7.0, @youasked/react-native 0.2.0).",
    tags: ["New", "Theming"],
  },
  {
    date: "2026-11-04",
    title: "The occasional prompt, and fixes for the Android keyboard",
    body: "A small “Got an idea?” card invites people to share, at most once a week by default, after 30 seconds of use and never on a first visit. Set how often in the dashboard. On Android the React Native sheet now sits right on the keyboard.",
    tags: ["New", "React Native"],
  },
  {
    date: "2026-11-03",
    title: "Public boards, roadmaps and changelogs",
    body: "Any app can turn on a public board at youasked.dev/your-app, with tabs for top requests, the roadmap and a changelog. Pages are rendered on the server so search engines can read them. Public pages show titles, votes, statuses and ship notes, and never emails or request text.",
    tags: ["New", "Public board"],
  },
  {
    date: "2026-11-03",
    title: "“You asked, it's live” share cards",
    body: "Every shipped request has a share page and a 1200 by 630 image to post, showing the request, how many people asked and where it's live. They work even when the board is private.",
    tags: ["New", "Share"],
  },
  {
    date: "2026-11-03",
    title: "Pricing: Solo, Pro and Studio",
    body: "Flat plans with unlimited end users and votes, monthly or yearly with two months free. Founding prices are locked for the first 100 paying workspaces. There is no free tier: until you subscribe, an app runs in test mode and answers only from localhost, and every plan has a 14-day money-back guarantee.",
    tags: ["Pricing"],
  },
  {
    date: "2026-11-03",
    title: "YouAsked moves to youasked.dev",
    body: "The site now lives at youasked.dev, with docs, an MCP page and honest comparisons with Canny and Featurebase. The API is at api.youasked.dev. Existing installs on the old workers.dev addresses keep working.",
    tags: ["Site"],
  },
  {
    date: "2026-10",
    title: "Beta: widget, CLI and MCP server",
    body: "@youasked/react, the youasked setup command and @youasked/mcp are on npm. People ask and vote inside your app, you hear it on Telegram, Slack or Discord, and “closes YA-12” in a commit ships a request and tells everyone who asked.",
    tags: ["Beta", "npm"],
  },
];

export function ChangelogPage() {
  return (
    <>
      <PageHead
        path="/changelog"
        eyebrow="Changelog"
        title="What's new in YouAsked"
        lede="What we shipped, newest first. Yes, we use YouAsked to tell you when we ship."
      />
      <div className="wrap narrow-doc">
        <ol className="log">
          {ENTRIES.map((e) => (
            <li key={e.title} className="log-item">
              <time dateTime={e.date}>{formatDate(e.date)}</time>
              <div>
                <h2 className="h3">{e.title}</h2>
                <p>{e.body}</p>
                <span className="log-tags">
                  {e.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </span>
              </div>
            </li>
          ))}
        </ol>
        <Prose>
          <Callout title="About this page">
            This changelog is static for now. When YouAsked&rsquo;s own board goes public, this page will render it straight from the public API (<code>/v1/public/apps/youasked/changelog</code>), so it will be generated by the same “closes YA-n” commits it describes.
          </Callout>
        </Prose>
      </div>
    </>
  );
}

function formatDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  return day ? `${day} ${month} ${y}` : `${month} ${y}`;
}
