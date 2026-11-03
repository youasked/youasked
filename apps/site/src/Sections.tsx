import { useEffect, useState } from "react";
import { AGENT_PROMPT, INSTALL_CMD, MCP_CMD, SITE } from "./content";
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
        <a className="brand" href="#top">
          <Mark className="brand-mark" />
          YouAsked
          <span className="pill-beta">Beta</span>
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#entry-points">Entry points</a>
          <a href="#agents">For agents</a>
          <a href="#pricing">Pricing</a>
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
            <h3 className="h3">Paste this into your agent</h3>
            <p>It reads the install guide, adds the entry points that fit your UI and signs your users.</p>
            <div className="codebox">
              {AGENT_PROMPT}
              <CopyButton text={AGENT_PROMPT} label="Copy prompt" />
            </div>
          </Reveal>
          <Reveal className="agent-block half" delay={60}>
            <h3 className="h3">Or run it yourself</h3>
            <p>Finds your framework, writes the keys and adds the components you pick.</p>
            <div className="codebox">
              <span className="dim">$ </span>
              {INSTALL_CMD}
              <CopyButton text={INSTALL_CMD} />
            </div>
          </Reveal>
          <Reveal className="agent-block half" delay={120}>
            <h3 className="h3">Let your agent ship requests</h3>
            <p>Lists the top asks, reads the details, replies and marks things shipped.</p>
            <div className="codebox">
              <span className="dim">$ </span>
              {MCP_CMD}
              <CopyButton text={MCP_CMD} />
            </div>
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
        <div className="works" aria-label="Works with">
          Works with <span>Claude Code</span>
          <span>Codex</span>
          <span>Cursor</span>
          <span>Telegram</span>
          <span>Slack</span>
          <span>Discord</span>
          <span>GitHub</span>
        </div>
      </div>
    </section>
  );
}

const PLANS = [
  { name: "Free", price: "$0", per: "", items: ["1 app", "Every entry point", "Telegram, GitHub and Slack", "Small “Feedback by YouAsked” line"] },
  { name: "Maker", price: "$15", per: "/month", items: ["Up to 5 apps", "No YouAsked branding", "Weekly digest", "Agent tools (MCP)"] },
  { name: "Studio", price: "$39", per: "/month", items: ["Unlimited apps", "Team members", "Priority support", "Everything in Maker"] },
];

export function Pricing() {
  return (
    <section className="section" id="pricing">
      <div className="wrap">
        <Reveal className="section-head">
          <h2 className="h2">One price for all your apps.</h2>
          <p className="lede">No per-seat or per-user pricing. Ship as many side projects as you like.</p>
        </Reveal>
        <Reveal className="prices">
          {PLANS.map((p) => (
            <div className="price" key={p.name}>
              <span className="name">{p.name}</span>
              <span className="amt">
                {p.price}
                {p.per && <small>{p.per}</small>}
              </span>
              <ul>
                {p.items.map((i) => (
                  <li key={i}>
                    <Check size={18} />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Reveal>
        <div className="beta-note">
          <i /> Everything is free while YouAsked is in beta.
        </div>
      </div>
    </section>
  );
}

const QUESTIONS = [
  {
    q: "Can a request make an AI change my code?",
    a: "No. Requests are treated as text people wrote, never as instructions. Nothing changes in your code unless you, or an agent you started, decides to build it, and nothing ships without your commit.",
  },
  {
    q: "What do you get about my users?",
    a: "Only what you pass. Sign a user ID on your server and that's all that leaves your app. Email and name are optional, and anonymous visitors work too.",
  },
  {
    q: "Which platforms does it support?",
    a: "React and Next.js today. React Native, Swift and Flutter are next, all on the same API.",
  },
  {
    q: "Do I have to use Telegram?",
    a: "No. Telegram gives you buttons to act on requests. Slack and Discord get a message for each request, and the web dashboard works anywhere.",
  },
];

export function Faq() {
  return (
    <section className="section" id="faq" style={{ paddingTop: 0 }}>
      <div className="narrow">
        <Reveal className="section-head">
          <h2 className="h2">Questions</h2>
        </Reveal>
        <div className="faq">
          {QUESTIONS.map((x) => (
            <details key={x.q}>
              <summary>{x.q}</summary>
              <p>{x.a}</p>
            </details>
          ))}
        </div>
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
        <div className="foot">
          <span>
            YouAsked · <a href={SITE}>{SITE.replace("https://", "")}</a>
          </span>
          <nav aria-label="Footer">
            <a href="/llms.txt">llms.txt</a>
            <a href="/install.md">install.md</a>
            <a href="/skill.md">skill.md</a>
            <a href="/index.md">Markdown</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
