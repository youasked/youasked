import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import type { LogoKey } from "./logo-data";
import { LogoRow } from "./Logos";
import { Check, SendIcon, reducedMotion } from "./ui";

const STEPS: { title: string; body: string; logos?: LogoKey[] }[] = [
  {
    title: "They ask, right where they are.",
    body: "An ask bar, a button or a quiet prompt next to a feature opens a sheet that feels like part of your app. They can circle the part of the screen they mean. As they type, it finds what others already asked, so one vote replaces ten duplicates.",
  },
  {
    title: "You hear it on your phone.",
    body: "Every request lands in Telegram, Slack or Discord with buttons to plan, merge or reply. Your reply reaches everyone who asked, inside the app. No dashboard to check.",
    logos: ["telegram", "slack", "discord"],
  },
  {
    title: "You ship with a commit.",
    body: "Write “closes YA-12” in a commit or pull request. When it lands, YouAsked marks it shipped and writes the note from your commit. Or let your agent pick the top request and do the whole thing.",
    logos: ["github", "claude", "openai", "cursor"],
  },
  {
    title: "Everyone who asked hears about it.",
    body: "The next time they open your app, a card says what they asked for is live. That's the moment people tell their friends.",
  },
];

export function Story() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className="night section" id="how">
      <div className="wrap">
        <div className="section-head">
          <h2 className="h2">From “can you add…” to “it's live”, without opening a dashboard.</h2>
        </div>
        <div className="story">
          <div className="story-steps">
            {STEPS.map((s, i) => (
              <div
                key={i}
                className="story-step"
                data-i={i}
                data-active={active === i || undefined}
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
              >
                <span className="num">
                  <b>{i + 1}</b>
                </span>
                <h3 className="h3">{s.title}</h3>
                <p>{s.body}</p>
                {s.logos && (
                  <div className="step-logos">
                    <LogoRow keys={s.logos} />
                  </div>
                )}
                <MobileScene index={i} />
              </div>
            ))}
          </div>
          <div className="story-stage-col">
            <div className="story-stage">
              <div className="story-bg" />
              <SceneAsk active={active === 0} />
              <SceneHear active={active === 1} />
              <SceneShip active={active === 2} />
              <SceneTell active={active === 3} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** On phones the stage can't stay pinned, so each step plays its own scene when it scrolls in. */
function MobileScene({ index }: { index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Scene = [SceneAsk, SceneHear, SceneShip, SceneTell][index];
  return (
    <div className="story-mobile-stage" ref={ref}>
      <div className="story-bg" />
      <Scene active={visible} />
    </div>
  );
}

/** Runs a timeline while the scene is active, and resets it when it isn't. */
function useScene(active: boolean, build: (q: (s: string) => Element[], tl: gsap.core.Timeline) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !active || reducedMotion()) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2 });
      build(gsap.utils.selector(root), tl);
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return ref;
}

function type(el: Element | undefined, text: string, duration: number) {
  const s = { n: 0 };
  return gsap.to(s, {
    n: text.length,
    duration,
    ease: "none",
    onUpdate: () => {
      if (el) el.textContent = text.slice(0, Math.round(s.n));
    },
  });
}

function Phone({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <div className="phone">
      <div className="phone-screen" style={dark ? { background: "#000", color: "#fff" } : undefined}>
        <div className="island" />
        <div className="statusbar">
          <span>9:41</span>
          <span className="sb-icons">
            <i />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function AppHome() {
  return (
    <div className="app">
      <div className="app-head">
        <b>Acme</b>
      </div>
      <div className="app-body">
        <div className="app-card">
          <div className="k">This month</div>
          <div className="v">$1,284.20</div>
        </div>
        <div className="app-card" style={{ padding: "6px 16px" }}>
          <div className="app-row">
            <span className="ic">🛒</span>Groceries<span className="amt">$86.40</span>
          </div>
          <div className="app-row">
            <span className="ic">🚕</span>Taxi<span className="amt">$18.20</span>
          </div>
          <div className="app-row">
            <span className="ic">☕</span>Starbucks<span className="amt">$7.90</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SceneAsk({ active }: { active: boolean }) {
  const ref = useScene(active, (q, tl) => {
    tl.set(q(".s1-tray, .s1-voted, .s1-reply"), { opacity: 0, y: 10 })
      .set(q(".s1-vote"), { background: "#fff", color: "#000", borderColor: "#e5e5ea" })
      .call(() => {
        q(".s1-count").forEach((el) => (el.textContent = "14"));
        q(".s1-text").forEach((el) => (el.textContent = ""));
      })
      .from(q(".chat-sheet"), { yPercent: 100, duration: 0.7, ease: "expo.out" })
      .add(type(q(".s1-text")[0], "Can I split a bill with my partner?", 1.8), "+=0.4")
      .to(q(".s1-tray"), { opacity: 1, y: 0, duration: 0.4, ease: "expo.out" }, "-=0.5")
      .to(q(".s1-vote"), { scale: 0.9, duration: 0.12, yoyo: true, repeat: 1 }, "+=0.7")
      .set(q(".s1-vote"), { background: "#5b3df5", color: "#fff", borderColor: "#5b3df5" })
      .call(() => q(".s1-count").forEach((el) => (el.textContent = "15")))
      .call(() => q(".s1-text").forEach((el) => (el.textContent = "")), [], "+=0.3")
      .to(q(".s1-tray"), { opacity: 0, y: 10, duration: 0.3 }, "+=0.4")
      .to(q(".s1-reply"), { opacity: 1, y: 0, duration: 0.45, ease: "back.out(1.6)" })
      .to({}, { duration: 2.4 });
  });
  return (
    <div className="scene" data-active={active || undefined} ref={ref} aria-hidden="true">
      <Phone>
        <AppHome />
        <div className="chat-sheet">
          <div className="grab" />
          <div className="ch-head">Acme<span>Ideas, votes and what's new</span>
          </div>
          <div className="chat-msgs">
            <div className="bub in">Hey! What would make Acme better for you?</div>
            <div className="bub in s1-reply">
              Added your vote to <b>Split a bill with my partner</b>. We'll tell you right here when it ships.
            </div>
          </div>
          <div className="tray s1-tray">
            <div className="th">Sounds like one of these. Vote instead?</div>
            <div className="tr">
              <span className="tv s1-vote">
                ▲<br />
                <span className="s1-count">14</span>
              </span>
              Split a bill with my partner
            </div>
          </div>
          <div className="composer">
            <span className="txt s1-text" />
            <span className="send">
              <SendIcon />
            </span>
          </div>
        </div>
      </Phone>
    </div>
  );
}

function SceneHear({ active }: { active: boolean }) {
  const ref = useScene(active, (q, tl) => {
    tl.set(q(".s2-card, .s2-prompt, .s2-out, .s2-sent"), { opacity: 0, y: 14 })
      .call(() => q(".s2-status").forEach((el) => (el.textContent = "")))
      .to(q(".s2-card"), { opacity: 1, y: 0, duration: 0.55, ease: "expo.out" }, "+=0.3")
      .call(() => q(".s2-reply").forEach((el) => el.classList.remove("tap")), [], "+=1.1")
      .call(() => q(".s2-reply").forEach((el) => el.classList.add("tap")))
      .to(q(".s2-prompt"), { opacity: 1, y: 0, duration: 0.45, ease: "expo.out" }, "+=0.3")
      .to(q(".s2-out"), { opacity: 1, y: 0, duration: 0.45, ease: "expo.out" }, "+=0.9")
      .to(q(".s2-sent"), { opacity: 1, y: 0, duration: 0.4, ease: "expo.out" }, "+=0.5")
      .to({}, { duration: 2.6 });
  });
  return (
    <div className="scene" data-active={active || undefined} ref={ref} aria-hidden="true">
      <div className="float-card tg" style={{ position: "relative", width: 400 }}>
        <div className="tg-head">
          <span className="tg-ava">G</span>
          <div>
            <div className="tg-name">Acme requests</div>
            <div className="tg-sub">bot</div>
          </div>
        </div>
        <div className="tg-body" style={{ minHeight: 420 }}>
          <div className="s2-card">
            <div className="tg-msg">
              💡 New request · <b>Acme</b> · YA-12<span className="s2-status" />
              <br />
              <b>Split a bill with my partner</b>
              <br />
              We share groceries and rent. Tag one as 50/50?
              <div className="tg-meta">Mei · 15 votes</div>
              <div style={{ marginTop: 6, fontSize: 12.5 }}>🔁 Looks like YA-9 “Split expenses” (2 votes)</div>
            </div>
            <div className="tg-keys">
              <span>📌 Planned</span>
              <span>🛠 Doing</span>
              <span>✅ Shipped</span>
              <span className="s2-reply">💬 Reply</span>
              <span style={{ gridColumn: "span 2" }}>🔀 Merge into YA-9</span>
            </div>
          </div>
          <div className="tg-msg s2-prompt">💬 Reply to YA-12. It goes to everyone who asked, in the app.</div>
          <div className="tg-out s2-out">Would a simple “who owes who” total be enough to start?</div>
          <div className="tg-msg s2-sent" style={{ alignSelf: "flex-start" }}>
            ✓ Sent to 15 people in the app.
          </div>
        </div>
      </div>
    </div>
  );
}

function SceneShip({ active }: { active: boolean }) {
  const ref = useScene(active, (q, tl) => {
    tl.set(q(".s3-line"), { opacity: 0 })
      .call(() => q(".s3-typed").forEach((el) => (el.textContent = "")))
      .to(q(".s3-line.a"), { opacity: 1, duration: 0.2 }, "+=0.3")
      .add(type(q(".s3-line.a .s3-typed")[0], "/youasked top", 0.7))
      .to(q(".s3-line.b"), { opacity: 1, duration: 0.25, stagger: 0.12 }, "+=0.3")
      .to(q(".s3-line.c"), { opacity: 1, duration: 0.2 }, "+=0.6")
      .add(type(q(".s3-line.c .s3-typed")[0], "Build YA-12, then commit", 1))
      .to(q(".s3-line.d"), { opacity: 1, duration: 0.25, stagger: 0.35 }, "+=0.4")
      .to(q(".s3-line.e"), { opacity: 1, duration: 0.2 }, "+=0.3")
      .add(type(q(".s3-line.e .s3-typed")[0], 'git commit -m "Split a bill 50/50 (closes YA-12)" && git push', 1.8))
      .to(q(".s3-line.f"), { opacity: 1, duration: 0.3, stagger: 0.3 }, "+=0.5")
      .to({}, { duration: 2.6 });
  });
  return (
    <div className="scene" data-active={active || undefined} ref={ref} aria-hidden="true">
      <div className="float-card term" style={{ position: "relative", width: "min(540px, 92%)" }}>
        <div className="term-bar">
          <i />
          <i />
          <i />
          <span>claude · graiden</span>
        </div>
        <div className="term-body" style={{ minHeight: 360, fontSize: 13.5 }}>
          <div className="s3-line a">
            <span className="hl">› </span>
            <span className="s3-typed" />
          </div>
          <div className="s3-line b dim">&nbsp;&nbsp;YA-12 Split a bill with my partner · 15 votes · planned</div>
          <div className="s3-line b dim">&nbsp;&nbsp;YA-9&nbsp; Monthly budget per category · 11 votes</div>
          <div className="s3-line b dim">&nbsp;&nbsp;YA-14 Import my bank statement PDF · 6 votes</div>
          <div className="s3-line c" style={{ marginTop: 10 }}>
            <span className="hl">› </span>
            <span className="s3-typed" />
          </div>
          <div className="s3-line d dim">&nbsp;&nbsp;Reading YA-12 and 2 comments…</div>
          <div className="s3-line d dim">&nbsp;&nbsp;Edited 3 files: split.ts, ExpenseSheet.tsx, totals.ts</div>
          <div className="s3-line e" style={{ marginTop: 10 }}>
            <span className="p">$ </span>
            <span className="s3-typed" />
          </div>
          <div className="s3-line f dim">→ youasked: YA-12 marked shipped</div>
          <div className="s3-line f ok">✓ 15 people who asked were told</div>
        </div>
      </div>
    </div>
  );
}

function SceneTell({ active }: { active: boolean }) {
  const ref = useScene(active, (q, tl) => {
    tl.set(q(".live-toast"), { opacity: 0, y: 30, scale: 0.94 })
      .set(q(".told"), { opacity: 0, y: 16 })
      .to(q(".live-toast"), { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "back.out(1.7)" }, "+=0.5")
      .from(q(".live-toast .l"), { scale: 0.6, opacity: 0, duration: 0.4, ease: "back.out(3)" }, "-=0.3")
      .to(q(".told"), { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }, "+=0.4")
      .to({}, { duration: 3.2 });
  });
  return (
    <div className="scene scene-tell" data-active={active || undefined} ref={ref} aria-hidden="true">
      <Phone>
        <AppHome />
        <div className="live-toast">
          <div className="k">You asked for</div>
          <div className="t">Split a bill with my partner</div>
          <div className="l">
            <Check size={15} /> It's live
          </div>
          <div className="n">Tap any expense, then Split 50/50. Thanks to Mei for asking.</div>
        </div>
      </Phone>
      <div className="told">
        <span className="faces">
          {["#f6b0a5", "#9fc5ff", "#ffd27a", "#b9a4ff", "#9ee2b8"].map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
        </span>
        15 people who asked were told
      </div>
    </div>
  );
}
