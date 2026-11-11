import { INSTALL_CMD, MCP_CMD, SITE, AGENT_PROMPT } from "./content";
import { Callout, Code, PageHead, Prose } from "./Page";

const TOC: [string, string][] = [
  ["install", "Install"],
  ["test-mode", "Test mode"],
  ["entry-points", "Entry points"],
  ["more-ways", "More ways to ask"],
  ["identity", "Identify your users"],
  ["theming", "Theming"],
  ["integrations", "Integrations"],
  ["ship", "Ship a request"],
  ["public-board", "Public board"],
  ["mcp", "MCP server"],
  ["cli", "CLI"],
  ["react-native", "React Native"],
  ["ios", "iOS (Swift)"],
  ["android", "Android (Kotlin)"],
  ["web", "Any website"],
  ["self-host", "Self-hosting"],
];

export function DocsPage() {
  return (
    <>
      <PageHead
        path="/docs"
        eyebrow="Docs"
        title="Add feature requests to your app"
        lede="Install YouAsked, pick where people ask, sign your users and ship from a commit. Everything here is also in plain Markdown at /install.md for your coding agent."
      />
      <div className="wrap docs-grid">
        <nav className="docs-toc" aria-label="On this page">
          {TOC.map(([id, name]) => (
            <a key={id} href={`#${id}`}>
              {name}
            </a>
          ))}
        </nav>
        <Prose className="docs-body">
          <h2 id="install">Install</h2>
          <p>
            In a React or Next.js project, run this in the project root. It finds your framework, creates the app, writes the keys to your env file and adds the components you choose.
          </p>
          <Code label="Terminal">{`$ ${INSTALL_CMD}`}</Code>
          <p>Or let your coding agent do it. Paste this into Claude Code, Codex or Cursor:</p>
          <Code label="Prompt">{AGENT_PROMPT}</Code>
          <p>To do it by hand:</p>
          <Code label="Terminal">{`npm i @youasked/react`}</Code>
          <Code label=".env.local">{`NEXT_PUBLIC_YOUASKED_KEY=ya_pub_…   # publishable, safe in client code
YOUASKED_SECRET_KEY=ya_sec_…        # server only, never ship it to the browser`}</Code>
          <p>Wrap the app once, near the root. In the Next.js App Router, put it in a client component and use it in the root layout:</p>
          <Code label="app/feature-requests.tsx">{`"use client";
import { YouAsked } from "@youasked/react";

export function FeatureRequests({ children }: { children: React.ReactNode }) {
  return (
    <YouAsked appKey={process.env.NEXT_PUBLIC_YOUASKED_KEY!} trigger="none">
      {children}
    </YouAsked>
  );
}`}</Code>
          <p>
            <code>trigger=&quot;floating&quot;</code> (the default) adds a chat-bubble launcher in the corner. Use <code>&quot;none&quot;</code> when the app has a bottom tab bar or you prefer inline entry points.
          </p>

          <h2 id="test-mode">Test mode</h2>
          <p>
            Until a plan is active, your app is in test mode: it answers widget requests only from local origins (<code>localhost</code>, <code>127.0.0.1</code> and <code>*.localhost</code>). You can install it, ask for something in your own app and see the request reach you, all for free. Visitors on your real domain see nothing until you subscribe. Every plan has a 14-day money-back guarantee, see <a href="/pricing">pricing</a>.
          </p>

          <h2 id="entry-points">Entry points</h2>
          <p>Choose what fits your UI. All of them open the same chat-style sheet.</p>
          <div className="tbl-wrap">
            <table className="tbl tbl-docs">
              <thead>
                <tr>
                  <th scope="col">Component</th>
                  <th scope="col">Use it for</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["<AskBar />", "A chat-style input at the top of a home screen or under an empty state"],
                  ["<FeatureCard />", "Top requests with vote buttons on a dashboard"],
                  ['<RequestButton variant="icon" />', "A round button in a header, with a badge when something ships"],
                  ['<RequestButton variant="row" />', "A row in a settings menu"],
                  ['<RequestButton variant="pill" />', "A tinted pill anywhere"],
                  ["<FeatureBoard />", "The whole experience inline on a /feedback page"],
                  ['useYouAsked().open({ view: "new", draft: "Export to Excel" })', "From any button, for example a locked feature"],
                ].map(([c, u]) => (
                  <tr key={c}>
                    <th scope="row">
                      <code>{c}</code>
                    </th>
                    <td>{u}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 id="more-ways">More ways to ask</h2>
          <ul>
            <li>
              <b>Show us.</b> The composer has a button that lets people drag boxes over what they mean on your page. A screenshot goes with their message. The screenshot library loads only when someone taps it.
            </li>
            <li>
              <b>
                <code>&lt;AskAbout topic=&quot;charts&quot; /&gt;</code>
              </b>{" "}
              is a quiet link next to a feature. It opens the composer asking &ldquo;What would make charts better?&rdquo; and saves the topic with the request.
            </li>
            <li>
              <b>
                <code>&lt;AskForIt query={"{searchText}"} /&gt;</code>
              </b>{" "}
              belongs in empty search states: &ldquo;Can&rsquo;t find &lsquo;export&rsquo;? Ask for it&rdquo;.
            </li>
            <li>
              <b>What&rsquo;s new.</b> When people open the sheet, they see what shipped since they were last shown the list, with a small celebration if it was theirs.
            </li>
            <li>
              <b>Credit and early access.</b> Identified users with a name can tick &ldquo;Credit me when it ships&rdquo;, and voters on planned requests can tap &ldquo;Try it early&rdquo;.
            </li>
            <li>
              <b>
                <code>&lt;YouAsked demo /&gt;</code>
              </b>{" "}
              needs no key and no network. It shows sample requests and a pretend team that replies, for docs, Storybook and landing pages.
            </li>
          </ul>

          <h2 id="identity">Identify your users</h2>
          <p>
            Without this, visitors are anonymous (one ID per device). If your app has sign-in, sign the user&rsquo;s ID on your server so nobody can vote as someone else:
          </p>
          <Code label="app/api/youasked/identity/route.ts">{`import { signUser } from "@youasked/react/server";

export async function GET() {
  const user = await getCurrentUser(); // your auth
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({
    userId: user.id,
    signature: await signUser(process.env.YOUASKED_SECRET_KEY!, user.id),
  });
}`}</Code>
          <p>
            Pass the result to the provider: <code>{"user={{ id: userId }} signature={signature} ready={loaded}"}</code>. Signatures are HMAC-SHA256 of the user ID, made with your secret key. Name is optional and only shown to your team.
          </p>
          <p>
            <b>Email.</b> To have YouAsked email someone when what they asked for ships, sign their email too, <code>signUser(secret, user.id, user.email)</code>, and pass the same email in <code>user</code>. We only ever email an address your server signed, and only from apps on a plan, so nobody can make YouAsked mail an address they typed in. The signature is then HMAC-SHA256 of <code>{"`${id}\n${email}`"}</code>, with the email trimmed and lowercased.
          </p>

          <h2 id="theming">Theming</h2>
          <p>
            YouAsked reads shadcn tokens (<code>--primary</code>, <code>--background</code>, <code>--radius</code>) on its own, and follows your <code>.dark</code> class or <code>data-theme</code>. Otherwise, pass an <code>appearance</code>:
          </p>
          <Code label="TSX">{`<YouAsked
  appearance={{
    accent: "var(--accent)",
    background: "var(--card)",
    radius: 16,           // cards, rows and the sheet
    buttonRadius: "pill", // buttons, the ask bar, the composer and chips: a number, any CSS length, or "pill"
    fontFamily: "inherit",
  }}
/>`}</Code>
          <p>
            Leave <code>buttonRadius</code> out and each control keeps its own shape: buttons follow <code>radius</code>, and the ask bar and chips are round. The same <code>appearance</code> works in React Native, with numbers in points.
          </p>

          <h2 id="integrations">Integrations</h2>
          <ul>
            <li>
              <b>Telegram.</b> Every request lands in a chat with buttons for Planned, Shipped, Reply and Merge. Replying to a card answers the requester inside your app.
            </li>
            <li>
              <b>Slack and Discord.</b> A message for each request and each ship, through a webhook.
            </li>
            <li>
              <b>GitHub.</b> Add the webhook shown in the dashboard. Then <code>closes YA-12</code> in a commit on the default branch, or in a merged pull request, marks YA-12 shipped. Add a token too, and Build it opens an issue you can <a href="#agents">hand to Copilot or @claude</a>.
            </li>
          </ul>

          <h2 id="ship">Ship a request</h2>
          <p>
            Every request has a number, like <code>YA-12</code>. Put <b>closes YA-12</b> in a commit message or merged pull request and YouAsked marks it shipped, drafts the note from your commit and tells everyone who asked. Every shipped request also gets a <a href="/changelog">share page</a> and a &ldquo;You asked, it&rsquo;s live&rdquo; image you can post.
          </p>

          <h2 id="agents">Hand a request to an agent</h2>
          <p>
            Open a request and tap <b>Build it</b>. You get a prompt with the request, the votes, what people said, screenshots and acceptance criteria, and three ways to send it off:
          </p>
          <ul>
            <li>
              <b>Assign to Copilot.</b> We open a GitHub issue with the brief and assign it to GitHub Copilot&rsquo;s coding agent, which opens a pull request. Your token needs read and write access to issues, contents, pull requests and actions, and the Copilot coding agent has to be on for the repo.
            </li>
            <li>
              <b>Ask @claude on GitHub.</b> We open the issue and mention <code>@claude</code> on it, for the Claude Code GitHub Action. Set the action up once by running <code>/install-github-app</code> in Claude Code. The token only needs issues.
            </li>
            <li>
              <b>Open in Cursor.</b> Opens Cursor with the prompt filled in, through Cursor&rsquo;s prompt link. Nothing else to set up.
            </li>
          </ul>
          <p>
            Copilot and @claude are also buttons on the Build it reply in Telegram, so you can send a request off from your phone. Handing off moves the request to In progress, and the brief asks for <code>closes YA-12</code> in the pull request, so merging it ships the request and tells everyone who asked. Anything users wrote is fenced off in the brief and marked as data, never instructions, so a request can&rsquo;t tell the agent to do something else. Only owners and admins can hand off.
          </p>
          <p>Prefer your own agent? Copy the prompt into Claude Code, Codex or anything else, or let it pick requests itself through the <a href="#mcp">MCP server</a>.</p>

          <h2 id="public-board">Public board</h2>
          <p>
            Turn on a public board and your requests, roadmap and changelog live at <code>youasked.dev/your-app</code>, where search engines can find them. Set a slug and switch it on from the dashboard, or with the admin API:
          </p>
          <Code label="Terminal">{`curl -X PATCH https://api.youasked.dev/v1/admin/app \\
  -H "Authorization: Bearer $YOUASKED_SECRET_KEY" \\
  -d '{"slug": "your-app", "publicBoard": true, "description": "What your app does."}'`}</Code>
          <p>
            Public pages show titles, vote counts, statuses and ship notes. They never show emails, user IDs or request text. A shipped request&rsquo;s share page at <code>youasked.dev/your-app/shipped/12</code> works even when the board itself is private.
          </p>

          <h2 id="mcp">MCP server</h2>
          <p>Let Claude or your coding agent read the top requests, build them and ship them. The hosted connector needs no key: you sign in and approve it once.</p>
          <Code label="Claude Code">{"claude mcp add --transport http youasked https://api.youasked.dev/mcp"}</Code>
          <p>In claude.ai, add a custom connector with the address <code>https://api.youasked.dev/mcp</code>. Prefer a local server with your secret key (Cursor, Codex and others)? Use the npx package:</p>
          <Code label="Terminal">{MCP_CMD}</Code>
          <p>
            It gives your agent tools to list, read, search, reply to, merge and ship requests. More on the <a href="/mcp">MCP server page</a>.
          </p>

          <h2 id="cli">CLI</h2>
          <div className="tbl-wrap">
            <table className="tbl tbl-docs">
              <tbody>
                <tr>
                  <th scope="row">
                    <code>youasked init</code>
                  </th>
                  <td>Sets up this project: creates the app, saves the keys, installs the package and wraps your app. Safe to run again.</td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>youasked doctor</code>
                  </th>
                  <td>Checks the env vars, the install and that the API accepts your keys.</td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>youasked open</code>
                  </th>
                  <td>Prints your dashboard URL.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            <code>init</code> takes <code>--yes</code> (every default), <code>--no-install</code>, <code>--key</code> and <code>--secret</code> (reuse an app) and <code>--api</code>. It can also add a Claude Code skill and a short section in <code>AGENTS.md</code>.
          </p>

          <h2 id="react-native">React Native and Expo</h2>
          <p>
            <code>@youasked/react-native</code> has the same components and props as the web package, drawn with native views: a bottom sheet you can swipe away, keyboard-aware, with the Android back button and haptics. It needs nothing beyond React Native itself, so it works in Expo Go. <code>youasked init</code> sets it up in an Expo app.
          </p>
          <Code label="Terminal">{`npm i @youasked/react-native
npx expo install @react-native-async-storage/async-storage expo-haptics   # optional`}</Code>
          <Code label="app/_layout.tsx">{`import { YouAsked } from "@youasked/react-native";

export default function RootLayout() {
  return (
    <YouAsked appKey={process.env.EXPO_PUBLIC_YOUASKED_KEY!} trigger="none">
      <Stack />
    </YouAsked>
  );
}`}</Code>
          <p>
            Then add <code>&lt;RequestButton variant="row" /&gt;</code> to a settings screen, <code>&lt;RequestButton variant="icon" /&gt;</code> to a header or <code>&lt;FeatureCard /&gt;</code> to a home screen. Sign users on your server, never in the app. Dev builds work in test mode.
          </p>

          <h2 id="ios">iOS: Swift and SwiftUI</h2>
          <p>
            A native SwiftUI sheet with detents, a keyboard-aware composer, Dynamic Type and VoiceOver, and no third-party dependencies. Builds for iOS 15 and up; tested on iOS 18 and 26. Add the package in Xcode (File, Add Package Dependencies) with <code>https://github.com/youasked/youasked</code>, then:
          </p>
          <Code label="MyApp.swift">{`import SwiftUI
import YouAsked

@main
struct MyApp: App {
    init() {
        YouAsked.configure(appKey: "ya_pub_…")
    }
    var body: some Scene {
        WindowGroup {
            ContentView().youAsked()   // launcher, cards, the occasional prompt and the sheet
        }
    }
}`}</Code>
          <p>
            Open it from anywhere with <code>YouAsked.open()</code> or <code>YouAsked.open(topic: "charts")</code>. The entry points are <code>YAAskBar</code>, <code>YAFeatureCard</code>, <code>YARequestButton(.row)</code> and <code>YAAskAbout(topic:)</code>. Sign people in with <code>YouAsked.identify(user:signature:)</code>, using a signature from your server. Set <code>YouAsked.appearance</code> to match your app, with the same fields as the web, including <code>buttonRadius: .pill</code>. Debug builds run in test mode.
          </p>

          <h2 id="android">Android: Kotlin and Jetpack Compose</h2>
          <p>
            A Material 3 bottom sheet that sits on the keyboard with edge-to-edge on, the back button, TalkBack labels, and no networking libraries. Builds for Android 7 (API 24) and up; tested on Android 16. Add JitPack to your repositories, then the dependency:
          </p>
          <Code label="build.gradle.kts">{`// settings.gradle.kts: repositories { maven("https://jitpack.io") }
implementation("com.github.youasked:youasked:0.1.0")`}</Code>
          <Code label="Kotlin">{`// Application.onCreate
YouAsked.configure(this, appKey = "ya_pub_…")

// your activity
setContent {
    YouAskedHost {          // launcher, cards, the occasional prompt and the sheet
        AppContent()
    }
}`}</Code>
          <p>
            Open it from anywhere with <code>YouAsked.open()</code> or <code>YouAsked.open(topic = "charts")</code>. The composables are <code>AskBar</code>, <code>FeatureCard</code>, <code>RequestButton</code>, <code>AskAbout</code> and <code>FeatureBoard</code>. Sign people in with <code>YouAsked.identify(user, signature)</code>, and theme it with <code>YouAskedHost(appearance = YouAskedAppearance(…))</code>. Debuggable builds run in test mode.
          </p>

          <h2 id="web">Any website: Vue, Svelte, Angular, plain HTML</h2>
          <p>
            <code>@youasked/js</code> is the same widget bundled with Preact, so your site doesn't need React. It works in Vue, Svelte, Angular, Nuxt, Astro, plain HTML and no-code builders like Webflow, Framer and WordPress. With no build step, it's one script tag:
          </p>
          <Code label="HTML">{`<script src="https://cdn.jsdelivr.net/npm/@youasked/js"
        data-app-key="ya_pub_…" data-label="Ask us" defer></script>`}</Code>
          <p>
            The tag also takes <code>data-accent</code>, <code>data-mode</code>, <code>data-radius</code>, <code>data-button-radius</code>, <code>data-trigger="none"</code>, <code>data-position</code> and <code>data-nudge="off"</code>. With a bundler:
          </p>
          <Code label="TS">{`import { init, identify, open } from "@youasked/js";

init({ appKey: "ya_pub_…", label: "Ask us" });
identify({ id: user.id }, signatureFromYourServer);
open({ topic: "charts" });`}</Code>
          <p>The entry points are custom elements, and any link with <code>data-youasked-open</code> opens the sheet:</p>
          <Code label="HTML">{`<youasked-ask-bar></youasked-ask-bar>
<youasked-feature-card limit="3"></youasked-feature-card>
<youasked-request-button variant="row"></youasked-request-button>
<youasked-ask-about topic="charts"></youasked-ask-about>
<a href="#" data-youasked-open>Request a feature</a>`}</Code>
          <p>
            In Vue, tell the compiler the <code>youasked-</code> tags are custom elements (<code>isCustomElement: (t) =&gt; t.startsWith("youasked-")</code>). In Angular, add <code>CUSTOM_ELEMENTS_SCHEMA</code>. Call <code>init</code> in the browser only, for example in <code>onMounted</code>.
          </p>

          <h2 id="self-host">Self-hosting</h2>
          <p>
            The server is source-available under FSL-1.1-MIT. You can read it, run it and self-host it for your own apps, but not offer it as a competing hosted service, and each release becomes MIT two years after it ships. It&rsquo;s a Hono app on Cloudflare Workers and D1. The widget, CLI and MCP server are MIT. Point the packages at your own server with <code>apiUrl</code> and <code>YOUASKED_API_URL</code>.
          </p>
          <p>
            Source: <a href="https://github.com/youasked/youasked">github.com/youasked/youasked</a>.
          </p>
        </Prose>
      </div>
    </>
  );
}
