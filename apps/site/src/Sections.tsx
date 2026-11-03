import { useEffect, useState } from "react";
import { AGENT_PROMPT, INSTALL_CMD, MCP_CMD, SITE } from "./content";
import { LANDING_FAQ, type Faq } from "./faq";
import { Logo, LogoRow } from "./Logos";
import { Check, CopyButton, CopyIcon, Mark, Reveal, useCopied } from "./ui";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(false);
  const [copied, copy] = useCopied();
  useEffect(() => {
    const on = () => {
      setScrolled(window.scrollY > 24);
      // Switch to dark glass while a dark section is under the bar.
      const under = document.elementsFromPoint(window.innerWidth / 2, 40).find((el) => !el.closest(".nav"));
      setDark(Boolean(under?.closest(".night, .final")));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <nav className="nav" data-scrolled={scrolled || undefined} data-dark={dark || undefined} aria-label="Main">
      <div className="wrap nav-in">
        <a className="brand" href="/">
          <Mark className="brand-mark" />
          YouAsked
          <span className="pill-beta">Beta</span>
        </a>
        <div className="nav-links">
          <a href="/#how">How it works</a>
          <a href="/#entry-points">Entry points</a>
          <a href="/pricing">Pricing</a>
          <a href="/docs">Docs</a>
          <a href="/alternatives">Alternatives</a>
        </div>
        <div className="nav-cta">
          <a className="btn btn-glass" href="/llms.txt">
            llms.txt
          </a>
          <button type="button" className="btn btn-ink" onClick={() => copy(AGENT_PROMPT)}>
            {copied ? <Check size={16} /> : null}
            {copied ? "Copied" : "Get started"}
          </button>
        </div>
      </div>
    </nav>
  );
}

export function Agents() {
  const [mdCopied, copyMd] = useCopied();
  return (
    <section className="night section" id="agents">
      <div className="wrap">
        <Reveal className="section-head center">
          <h2 className="h2">Made for the agent you already use.</h2>
          <p className="lede">
            Paste one prompt into Claude Code, Codex or Cursor and it sets everything up. Then your agent can read the top requests, build them and ship them.
          </p>
        </Reveal>
        <div className="agent-grid">
          <Reveal className="agent-block">
            <div className="agent-logos" aria-label="Claude Code, Codex and Cursor">
              <Logo k="claude" size={22} />
              <Logo k="openai" size={22} />
              <Logo k="cursor" size={22} />
            </div>
            <h3 className="h3">Paste this into your agent</h3>
            <p>It reads the install guide, adds the entry points that fit your UI and signs your users.</p>
            <CodeBox label="Prompt" text={AGENT_PROMPT} copyLabel="Copy prompt" />
          </Reveal>
          <Reveal className="agent-block half" delay={60}>
            <h3 className="h3">Or run it yourself</h3>
            <p>Finds your framework, writes the keys and adds the components you pick.</p>
            <CodeBox label="Terminal" text={INSTALL_CMD} shell />
          </Reveal>
          <Reveal className="agent-block half" delay={120}>
            <h3 className="h3">Let your agent ship requests</h3>
            <p>Lists the top asks, reads the details, replies and marks things shipped.</p>
            <CodeBox label="Terminal" text={MCP_CMD} shell />
          </Reveal>
        </div>
        <Reveal className="ai-links" delay={80}>
          <a className="ai-link" href="/llms.txt">
            <code>llms.txt</code> overview for AI
          </a>
          <a className="ai-link" href="/install.md">
            <code>install.md</code> step by step
          </a>
          <a className="ai-link" href="/skill.md">
            <code>skill.md</code> Claude Code skill
          </a>
          <button
            type="button"
            className="ai-link"
            onClick={() => copyMd(() => fetch("/index.md").then((r) => r.text()))}
          >
            {mdCopied ? <Check size={14} /> : <CopyIcon />}
            {mdCopied ? "Copied" : "Copy this page as Markdown"}
          </button>
        </Reveal>
        <div className="works">
          <LogoRow keys={["claude", "openai", "cursor", "github", "telegram", "slack", "discord"]} />
        </div>
      </div>
    </section>
  );
}

export function CodeBox({ label, text, copyLabel, shell }: { label: string; text: string; copyLabel?: string; shell?: boolean }) {
  return (
    <div className="codebox">
      <div className="codebox-bar">
        <span>{label}</span>
        <CopyButton text={text} label={copyLabel} />
      </div>
      <pre>
        {shell && <span className="dim">$ </span>}
        {text}
      </pre>
    </div>
  );
}

export function FaqList({ items }: { items: Faq[] }) {
  return (
    <div className="faq">
      {items.map((x) => (
        <details key={x.q}>
          <summary>{x.q}</summary>
          <p>{x.a}</p>
        </details>
      ))}
    </div>
  );
}

export function FaqSection() {
  return (
    <section className="section" id="faq" style={{ paddingTop: 0 }}>
      <div className="narrow">
        <Reveal className="section-head">
          <h2 className="h2">Questions</h2>
        </Reveal>
        <FaqList items={LANDING_FAQ} />
      </div>
    </section>
  );
}

export function Final() {
  const [copied, copy] = useCopied();
  return (
    <footer className="final">
      <div className="sky-dark" aria-hidden="true" />
      <div className="wrap">
        <Reveal>
          <h2 className="display final-title">Ask. Ship. Tell.</h2>
        </Reveal>
        <div className="final-actions">
          <button type="button" className="btn btn-light" onClick={() => copy(AGENT_PROMPT)}>
            {copied ? <Check size={18} /> : <CopyIcon />}
            {copied ? "Copied. Paste it into your agent" : "Copy the setup prompt"}
          </button>
        </div>
        <SiteFoot />
      </div>
    </footer>
  );
}

const FOOT_GROUPS: { title: string; links: [string, string][] }[] = [
  {
    title: "Product",
    links: [
      ["How it works", "/#how"],
      ["Entry points", "/#entry-points"],
      ["Pricing", "/pricing"],
      ["Docs", "/docs"],
      ["MCP server", "/mcp"],
      ["Changelog", "/changelog"],
      ["Privacy policy", "/privacy"],
      ["Terms of service", "/terms"],
    ],
  },
  {
    title: "Compare",
    links: [
      ["All alternatives", "/alternatives"],
      ["Canny alternative", "/alternatives/canny"],
      ["YouAsked vs Featurebase", "/vs/featurebase"],
    ],
  },
  {
    title: "For agents",
    links: [
      ["llms.txt", "/llms.txt"],
      ["install.md", "/install.md"],
      ["skill.md", "/skill.md"],
      ["This site as Markdown", "/index.md"],
    ],
  },
  {
    title: "Open source",
    links: [
      ["GitHub", "https://github.com/youasked/youasked"],
      ["@youasked/react on npm", "https://www.npmjs.com/package/@youasked/react"],
      ["@youasked/mcp on npm", "https://www.npmjs.com/package/@youasked/mcp"],
    ],
  },
];

/** Every page of the site, so crawlers and people can reach any of them from any page. */
export function SiteFoot() {
  return (
    <div className="foot">
      <div className="foot-brand">
        <span className="foot-name">
          YouAsked
        </span>
        <p>Feature requests inside your app, and a note to everyone who asked when you ship.</p>
        <span>
          <a href={SITE}>{SITE.replace("https://", "")}</a>
        </span>
      </div>
      <nav className="foot-cols" aria-label="Footer">
        {FOOT_GROUPS.map((g) => (
          <div key={g.title}>
            <h3>{g.title}</h3>
            {g.links.map(([name, href]) => (
              <a key={href} href={href}>
                {name}
              </a>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
}

/** The footer on subpages. */
export function SubFooter() {
  return (
    <footer className="night sub-foot">
      <div className="wrap">
        <SiteFoot />
      </div>
    </footer>
  );
}
