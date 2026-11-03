import type { ReactNode } from "react";
import { FaqList } from "./Sections";
import type { Faq } from "./faq";
import { Callout, PageHead, Prose } from "./Page";
import { FOUNDING_SLOTS, GUARANTEE_DAYS, PLANS, money, price } from "./plans-view";

/** When the competitor facts on these pages were checked. */
export const CHECKED = "3 November 2026";

const ours = {
  solo: `${money(price("solo", "month", false))}`,
  soloF: `${money(price("solo", "month", true))}`,
  pro: `${money(price("pro", "month", false))}`,
  proF: `${money(price("pro", "month", true))}`,
  studio: `${money(price("studio", "month", false))}`,
  studioF: `${money(price("studio", "month", true))}`,
};

const OUR_PRICE = `Solo ${ours.solo}, Pro ${ours.pro}, Studio ${ours.studio} a month. Founding prices of ${ours.soloF}, ${ours.proF} and ${ours.studioF} for the first ${FOUNDING_SLOTS} paying workspaces.`;

type Row = [label: string, rival: ReactNode, us: ReactNode];

function Compare({ rival, rows }: { rival: string; rows: Row[] }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl tbl-vs">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr">Feature</span>
            </th>
            <th scope="col">{rival}</th>
            <th scope="col">YouAsked</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{a}</td>
              <td>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Lists({ rival, better, worse }: { rival: string; better: ReactNode[]; worse: ReactNode[] }) {
  return (
    <div className="vs-lists">
      <div className="vs-card">
        <h3>Where {rival} is better</h3>
        <ul>
          {worse.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
      <div className="vs-card us">
        <h3>Where YouAsked is better</h3>
        <ul>
          {better.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Canny */

export const CANNY_FAQ: Faq[] = [
  {
    q: "Is YouAsked a good Canny alternative?",
    a: "If you build an app on your own or with a small team and want feature requests inside the product, a flat price and an agent-friendly setup, yes. If you need a long-established portal, a wide set of support-tool integrations or a free tier, Canny is the safer pick today.",
  },
  {
    q: "How does Canny charge?",
    a: "By tracked users: anyone who votes, comments or is identified counts. Canny's own pricing announcement describes it as the number of people leaving feedback, and plans step up in blocks of 100 unless you set a spend limit. YouAsked charges a flat price per workspace with unlimited end users and votes.",
  },
  {
    q: "Can I import my Canny data into YouAsked?",
    a: "Import from Canny, Featurebase and CSV is part of the launch build, along with a full export, so switching shouldn't mean starting over. Check the docs for the current status before you move.",
  },
  {
    q: "Does YouAsked have a free plan like Canny?",
    a: "No. You can try YouAsked for free on localhost in test mode, and every plan has a 14-day money-back guarantee, but there is no free tier for live apps.",
  },
];

export function CannyPage() {
  return (
    <>
      <PageHead
        path="/alternatives/canny"
        eyebrow="Canny alternative"
        title="YouAsked vs Canny"
        lede="Canny is the best-known feature request board, and a good one. YouAsked is for people who want requests inside their app, a flat price and an agent that can ship them. Here is where each wins."
      />
      <div className="wrap narrow-doc">
        <Prose>
          <p className="fine">
            Competitor details were checked on {CHECKED} from public pricing pages and docs. Prices change, so check{" "}
            <a href="https://canny.io/pricing" rel="nofollow noopener">
              canny.io/pricing
            </a>{" "}
            before you decide.
          </p>
          <h2>The short version</h2>
          <ul>
            <li>
              <b>Pick Canny</b> if you want a proven hosted portal, a free tier, or integrations with support tools, and your tracked-user count stays small.
            </li>
            <li>
              <b>Pick YouAsked</b> if you want the whole thing to feel built into your app, you don&rsquo;t want your bill to grow with your audience, and you like the idea of Claude Code or Codex reading and shipping requests.
            </li>
          </ul>

          <h2>Side by side</h2>
          <Compare
            rival="Canny"
            rows={[
              ["Free tier", "Yes: 25 tracked users, 5 managers, Autopilot AI", "No. Free test mode on localhost, 14-day money-back guarantee on every plan"],
              ["Paid pricing", "Core from about $19 a month and Pro from about $79 a month on yearly billing, for 100 tracked users, then rising with tracked users", OUR_PRICE],
              ["What you are billed on", "Tracked users: anyone who votes, comments or is identified", "Workspace plan. Unlimited end users, votes and requests"],
              ["Where people ask", "A hosted portal. A widget exists, though Canny's docs recommend the full hosted site for most cases", "A chat-style sheet inside your app with several entry points: ask bar, cards, buttons, launcher, board"],
              ["Hearing about requests", "Dashboard, email and integrations", "Telegram with action buttons, Slack, Discord, GitHub, dashboard"],
              ["Roadmap and changelog", "Yes", "Yes, as a public board per app"],
              ["AI", "Autopilot pulls feedback from tools such as Intercom, Zendesk and Gong", "AI duplicate matching and a weekly digest, plus agents that read requests through MCP"],
              ["Agents and MCP", "An MCP server has been reported for paid plans", "MCP server, one-command CLI install, llms.txt, install guide and Claude Code skill, “closes YA-12” ships from a commit"],
              ["Mobile SDK", "None native", "React Native and Expo SDK coming. Web and React today"],
              ["Open source", "No", "Widget, CLI and MCP are MIT. The server is source-available (FSL) and can be self-hosted"],
              ["Track record", "Established, with a long track record", "New and in beta"],
            ]}
          />

          <h2>The pricing difference</h2>
          <p>
            Canny&rsquo;s own announcement says the number of people leaving feedback is what you pay for, and plans move up in steps of 100 tracked users unless you set a spend limit. A comparison published by a competitor, UserJot, puts Canny Pro at about $529 a month on yearly billing at 1,000 tracked users and about $1,079 at 5,000. We haven&rsquo;t verified those figures, so treat them as a guide and check Canny&rsquo;s page.
          </p>
          <p>
            YouAsked doesn&rsquo;t meter users. A popular app pays the same as a quiet one. In exchange, the plans cap apps and team members: {PLANS.solo.apps} app on Solo, {PLANS.pro.apps} on Pro and unlimited on Studio.
          </p>

          <Lists
            rival="Canny"
            worse={[
              "A free tier, so you can run a small board at no cost.",
              "A long track record and a mature hosted portal.",
              "Autopilot AI that gathers feedback from support tools you may already use.",
              "More integrations with product and support tools today, and enterprise plans with custom terms.",
            ]}
            better={[
              "Requests live inside your app, not on a separate site people have to find and sign in to.",
              "A flat price. Your bill doesn't rise when your app gets popular.",
              "Built for the agent era: one prompt to install, an MCP server, and a commit that ships a request and tells everyone who asked.",
              "Hear it on your phone with Telegram buttons to plan, merge or reply.",
              "Open source packages, and a server you can self-host.",
            ]}
          />

          <Callout title="Honest caveats">
            YouAsked is in beta. It has no free tier, no SSO, no Linear or Jira sync yet, and it supports React and Next.js first. If any of those is a blocker, Canny is the better choice today.
          </Callout>

          <h2>Questions</h2>
          <FaqList items={CANNY_FAQ} />
          <p>
            Ready to look? See <a href="/pricing">pricing</a>, read the <a href="/docs">docs</a> or compare with <a href="/vs/featurebase">Featurebase</a>. All comparisons are in the <a href="/alternatives">alternatives hub</a>.
          </p>
        </Prose>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Featurebase */

export const FEATUREBASE_FAQ: Faq[] = [
  {
    q: "How does Featurebase charge?",
    a: "Per seat. On its pricing page as of November 2026, Growth is $29 per seat a month ($23.20 on yearly billing), Professional $59 and Enterprise $99 per seat. Removing Featurebase branding is a separate $69 a month on Professional and Enterprise, and its AI agent is $0.49 per resolution. End users are unlimited.",
  },
  {
    q: "Is there a cheaper Featurebase alternative for a solo developer?",
    a: "Featurebase has a free plan for one seat. If you need more than that, YouAsked Solo costs $15 a month ($9 founding price), with no per-seat or per-resolution charges.",
  },
  {
    q: "Does Featurebase have an MCP server?",
    a: "Yes. Featurebase announced its MCP server on 4 May 2026. YouAsked has one too. The difference is what surrounds it: YouAsked adds in-app entry points, Telegram, and shipping from a commit so everyone who asked is told.",
  },
  {
    q: "What does Featurebase do that YouAsked doesn't?",
    a: "Featurebase is a wider product: feedback, roadmap and changelog together with a help center and an AI support agent. YouAsked does feature requests and closing the loop, and nothing else.",
  },
];

export function FeaturebasePage() {
  return (
    <>
      <PageHead
        path="/vs/featurebase"
        eyebrow="Featurebase alternative"
        title="YouAsked vs Featurebase"
        lede="Featurebase is a customer feedback and support suite. YouAsked is one thing: feature requests inside your app that tell people when you ship. Which one you need depends on what you are building."
      />
      <div className="wrap narrow-doc">
        <Prose>
          <p className="fine">
            Competitor details were checked on {CHECKED} from public pricing pages and docs. Prices change, so check{" "}
            <a href="https://www.featurebase.app/pricing" rel="nofollow noopener">
              featurebase.app/pricing
            </a>{" "}
            before you decide.
          </p>
          <h2>The short version</h2>
          <ul>
            <li>
              <b>Pick Featurebase</b> if you want feedback, a help center and AI support in one product, or you want a free plan for a single seat.
            </li>
            <li>
              <b>Pick YouAsked</b> if you only need feature requests, want them inside your app, and prefer one flat price to seats and metered AI.
            </li>
          </ul>

          <h2>Side by side</h2>
          <Compare
            rival="Featurebase"
            rows={[
              ["Free tier", "Yes: 1 seat, 1 board, 1 roadmap, 50 help articles. No AI, API or MCP", "No. Free test mode on localhost, 14-day money-back guarantee on every plan"],
              ["Paid pricing", "Growth $29, Professional $59, Enterprise $99 per seat a month (about 20% less on yearly billing)", OUR_PRICE],
              ["What you are billed on", "Seats. End users are unlimited. AI agent is $0.49 per resolution", "Workspace plan. Unlimited end users and votes, no metered AI charges"],
              ["Removing branding", "An extra $69 a month on Professional and Enterprise", `Included on Pro and Studio. Shown on Solo`],
              ["Trial", "10 days, no card", `No trial. Test mode on localhost, and a ${GUARANTEE_DAYS}-day money-back guarantee`],
              ["Scope", "Feedback boards, roadmap, changelog, help center, AI support agent", "Feature requests, roadmap, changelog and closing the loop. No help center"],
              ["Where people ask", "Hosted portal and an embeddable widget for JavaScript and React", "A chat-style sheet inside your app with several entry points"],
              ["Hearing about requests", "Dashboard, integrations", "Telegram with action buttons, Slack, Discord, GitHub, dashboard"],
              ["Agents and MCP", "MCP server, announced 4 May 2026, on paid plans", "MCP server, one-command CLI install, llms.txt and a Claude Code skill. “closes YA-12” ships from a commit"],
              ["Mobile SDK", "No native SDK", "React Native and Expo SDK coming"],
              ["Open source", "No", "Widget, CLI and MCP are MIT. The server is source-available (FSL) and can be self-hosted"],
              ["Startup discount", "A startup program with a large discount for eligible startups", `Founding prices for the first ${FOUNDING_SLOTS} paying workspaces`],
            ]}
          />

          <h2>The pricing difference</h2>
          <p>
            Featurebase prices by seat, so a team of three on Growth is $87 a month before any extras (3 &times; $29). YouAsked Pro covers {PLANS.pro.members} team members for {ours.pro} a month ({ours.proF} at the founding price). On the other hand, Featurebase&rsquo;s free plan for one seat costs nothing, and YouAsked has no free tier for live apps.
          </p>

          <Lists
            rival="Featurebase"
            worse={[
              "A free plan for one seat.",
              "A broader product: help center and an AI support agent alongside feedback.",
              "A startup program with deep discounts for eligible companies.",
            ]}
            better={[
              "A flat per-workspace price, with no per-seat, per-resolution or branding add-on charges.",
              "Requests are asked and voted on inside your app through a sheet that takes on your colours and font.",
              "The full loop for solo builders: a Telegram ping, a commit with “closes YA-12”, and everyone who asked is told.",
              "A one-command install an agent can run, and an open-source widget, CLI and MCP server.",
            ]}
          />

          <Callout title="Honest caveats">
            YouAsked is in beta, supports React and Next.js first, and has no help center, SSO or Linear sync yet. If you need a support suite, Featurebase is the better fit.
          </Callout>

          <h2>Questions</h2>
          <FaqList items={FEATUREBASE_FAQ} />
          <p>
            Ready to look? See <a href="/pricing">pricing</a>, read the <a href="/docs">docs</a> or compare with <a href="/alternatives/canny">Canny</a>. All comparisons are in the <a href="/alternatives">alternatives hub</a>.
          </p>
        </Prose>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- hub */

const OTHERS: [name: string, free: string, paid: string, note: string][] = [
  ["UserJot", "Yes: 2 boards, 3 team members", "$29 and $59 a month", "Flat tiers, unlimited end users, roadmap and changelog"],
  ["Frill", "No", "$25, $49, $149 and $349 a month", "Flat tiers, 14-day trial. The entry plan caps active ideas at 50"],
  ["Nolt", "No", "About $29 and $69 a month", "Per board. Price from public listings, not confirmed on the vendor page"],
  ["Upvoty", "No", "$15, $25 and $49 a month", "Flat. MCP only on the top plan"],
  ["Sleekplan", "Yes: one admin, unlimited items", "From $13 a month on yearly billing", "Seats plus usage add-ons"],
  ["Quackback", "Yes: 1 seat, 1 board, 50 posts", "$29 to $99 a month on yearly billing", "Open source (AGPL), MCP server from the $29 plan"],
  ["Fider", "Free up to 250 items", "$25 a month hosted", "Open source and basic: no roadmap, changelog or AI"],
];

export const HUB_FAQ: Faq[] = [
  {
    q: "What is the best Canny alternative for a solo developer or small team?",
    a: "It depends on what you need. For a free tier and a long track record, look at Canny itself or UserJot. For a full support suite, Featurebase. For feature requests inside your app, a flat price and an agent that can ship them, YouAsked. Open-source options include Quackback and Fider if you want to self-host.",
  },
  {
    q: "Which feedback tools charge per user?",
    a: "Canny prices by tracked users, and Featurebase by seat. Several others, including UserJot, Frill and Upvoty, use flat tiers. YouAsked is flat with unlimited end users and votes.",
  },
];

export function AlternativesPage() {
  return (
    <>
      <PageHead
        path="/alternatives"
        eyebrow="Alternatives"
        title="Feature request tool alternatives, compared honestly"
        lede="There are lots of good feedback tools. We wrote down where YouAsked fits, where it doesn't, and what the others charge, so you can pick the one that suits you."
      />
      <div className="wrap narrow-doc">
        <Prose>
          <p className="fine">Prices were checked on {CHECKED} from vendor pricing pages unless noted. They change, so confirm on the vendor&rsquo;s site.</p>
          <h2>In-depth comparisons</h2>
          <div className="vs-links">
            <a className="vs-link" href="/alternatives/canny">
              <b>YouAsked vs Canny</b>
              <span>Tracked-user pricing against a flat plan, and a portal against an in-app sheet.</span>
            </a>
            <a className="vs-link" href="/vs/featurebase">
              <b>YouAsked vs Featurebase</b>
              <span>A seat-priced support suite against a flat feature-request tool.</span>
            </a>
          </div>

          <h2>Other tools</h2>
          <div className="tbl-wrap">
            <table className="tbl tbl-vs">
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">Free plan</th>
                  <th scope="col">Paid</th>
                  <th scope="col">Worth knowing</th>
                </tr>
              </thead>
              <tbody>
                {OTHERS.map(([n, f, p, note]) => (
                  <tr key={n}>
                    <th scope="row">{n}</th>
                    <td>{f}</td>
                    <td>{p}</td>
                    <td>{note}</td>
                  </tr>
                ))}
                <tr className="us-row">
                  <th scope="row">YouAsked</th>
                  <td>No. Test mode on localhost</td>
                  <td>{OUR_PRICE}</td>
                  <td>In-app sheet, Telegram, MCP, ships from a commit. Beta</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>How to choose</h2>
          <ul>
            <li>
              <b>You want a free plan:</b> Canny, Featurebase, UserJot or Sleekplan, within their limits.
            </li>
            <li>
              <b>You need help center and AI support too:</b> Featurebase.
            </li>
            <li>
              <b>You want to self-host:</b> Quackback or Fider, or the YouAsked server under its source-available licence.
            </li>
            <li>
              <b>You build with Claude Code, Codex or Cursor, and want requests inside your app with a flat price:</b> YouAsked.
            </li>
          </ul>
          <h2>Questions</h2>
          <FaqList items={HUB_FAQ} />
          <p>
            See <a href="/pricing">YouAsked pricing</a> or the <a href="/docs">docs</a>.
          </p>
        </Prose>
      </div>
    </>
  );
}
