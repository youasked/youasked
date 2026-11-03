import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { FeatureBoard, YouAsked } from "@youasked/react";
import { AGENT_PROMPT, INSTALL_CMD } from "./content";
import { LogoRow } from "./Logos";
import { Check, CopyIcon, Mark, reducedMotion, useCopied } from "./ui";

gsap.registerPlugin(MotionPathPlugin);

// A typical app's look, so the phone shows the widget the way it sits inside a real app.
export const APP_LOOK = {
  accent: "#5b3df5",
  background: "#ffffff",
  foreground: "#000000",
  muted: "#6c6c70",
  surface: "#f2f2f7",
  border: "#e5e5ea",
  radius: 16,
  fontFamily: '"Instrument Sans", system-ui, sans-serif',
  mode: "light" as const,
};

export function Hero() {
  const [promptCopied, copyPrompt] = useCopied();
  const [cmdCopied, copyCmd] = useCopied();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    if (reducedMotion() || !titleRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero-title .line", { yPercent: 60, opacity: 0, duration: 1.1, ease: "expo.out", stagger: 0.18 });
      gsap.from(".stamp", { scale: 2.4, rotate: -24, opacity: 0, duration: 0.7, ease: "back.out(2.2)", delay: 0.95 });
      gsap.from(".hero-sub, .hero-actions", { y: 18, opacity: 0, duration: 0.9, ease: "expo.out", delay: 0.55, stagger: 0.08 });
      gsap.from(".stage-outer", { y: 60, opacity: 0, duration: 1.3, ease: "expo.out", delay: 0.7 });
    }, titleRef.current.closest(".hero")!);
    return () => ctx.revert();
  }, []);

  return (
    <header className="hero" id="top">
      <div className="sky" aria-hidden="true">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <div className="blob b4" />
        <div className="grain" />
      </div>
      <div className="wrap hero-copy">
        <h1 className="display hero-title" ref={titleRef} aria-label="You asked. It's live.">
          <span className="line">You asked.</span>
          <span className="line live-line">
            It's live
            <span className="stamp" aria-hidden="true">
              <Check />
            </span>
          </span>
        </h1>
        <p className="hero-sub">
          Feature requests that live inside your app, reach you on your phone, and tell everyone who asked the moment you ship.
        </p>
        <div className="hero-actions">
          <button type="button" className="btn btn-ink" onClick={() => copyPrompt(AGENT_PROMPT)}>
            {promptCopied ? <Check size={18} /> : <CopyIcon />}
            {promptCopied ? "Copied. Paste it into your agent" : "Copy the setup prompt"}
          </button>
          <button type="button" className="cmd" onClick={() => copyCmd(INSTALL_CMD)} aria-label={`Copy ${INSTALL_CMD}`}>
            <span>
              <span className="dollar">$ </span>
              {INSTALL_CMD}
            </span>
            <span className="copy-chip">{cmdCopied ? <Check size={16} /> : <CopyIcon />}</span>
          </button>
        </div>
        <div className="hero-works">
          <small>Works with the tools you already use</small>
          <LogoRow keys={["claude", "openai", "cursor", "github", "telegram", "slack", "discord"]} tone="light" />
        </div>
      </div>
      <HeroStage />
    </header>
  );
}

const STAGE_W = 1180;
const STAGE_H = 800;
const MOBILE_W = 420;

function HeroStage() {
  const outerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ scale: number; mobile: boolean }>({ scale: 1, mobile: false });

  useLayoutEffect(() => {
    const el = outerRef.current!;
    const fit = () => {
      const w = el.clientWidth;
      const mobile = w < 760;
      setLayout({ mobile, scale: Math.min(1, w / (mobile ? MOBILE_W : STAGE_W)) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The loop: someone asks in the app → you hear it in Telegram → a commit ships it → they're told.
  useEffect(() => {
    const root = stageRef.current;
    if (!root || reducedMotion()) return;
    const q = gsap.utils.selector(root);
    const path = (sel: string) => root.querySelector<SVGPathElement>(sel)!;
    const typeInto = (el: Element, text: string, duration: number) => {
      const state = { n: 0 };
      return gsap.to(state, {
        n: text.length,
        duration,
        ease: "none",
        onUpdate: () => {
          el.textContent = text.slice(0, Math.round(state.n));
        },
      });
    };
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4, delay: 2.2 });
      const reset = () => {
        gsap.set(q(".tg-card, .tg-out, .term-line, .live-toast"), { opacity: 0, y: 12 });
        gsap.set(q(".live-toast"), { y: 24, scale: 0.96 });
        gsap.set(q(".pulse"), { opacity: 0 });
        q(".term-typed").forEach((el) => (el.textContent = ""));
        q(".tg-status").forEach((el) => (el.textContent = ""));
      };
      tl.call(reset);
      if (!layout.mobile) {
        tl.set(q(".pulse.p1"), { opacity: 1 })
          .to(q(".pulse.p1"), { duration: 0.9, ease: "power2.inOut", motionPath: { path: path("#path-ask"), align: path("#path-ask"), alignOrigin: [0.5, 0.5] } })
          .set(q(".pulse.p1"), { opacity: 0 })
          .to(q(".tg-card"), { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" })
          .call(() => q(".tg-planned").forEach((el) => el.classList.remove("tap")), [], "+=0.9")
          .call(() => q(".tg-planned").forEach((el) => el.classList.add("tap")))
          .call(() => q(".tg-status").forEach((el) => (el.textContent = " · Planned")), [], "+=0.25")
          .to(q(".tg-out"), { opacity: 1, y: 0, duration: 0.45, ease: "expo.out" }, "+=0.35")
          .set(q(".pulse.p2"), { opacity: 1 }, "+=0.4")
          .to(q(".pulse.p2"), { duration: 1.4, ease: "power1.inOut", motionPath: { path: path("#path-ship"), align: path("#path-ship"), alignOrigin: [0.5, 0.5] } })
          .set(q(".pulse.p2"), { opacity: 0 })
          .to(q(".term-line.l1"), { opacity: 1, y: 0, duration: 0.3 })
          .add(typeInto(q(".term-line.l1 .term-typed")[0], 'git commit -m "Split a bill 50/50 (closes YA-12)"', 1.6))
          .to(q(".term-line.l2"), { opacity: 1, y: 0, duration: 0.3 }, "+=0.3")
          .add(typeInto(q(".term-line.l2 .term-typed")[0], "git push", 0.4))
          .to(q(".term-line.l3"), { opacity: 1, y: 0, duration: 0.35 }, "+=0.5")
          .to(q(".term-line.l4"), { opacity: 1, y: 0, duration: 0.35 }, "+=0.25")
          .set(q(".pulse.p3"), { opacity: 1 }, "+=0.2")
          .to(q(".pulse.p3"), { duration: 0.7, ease: "power2.inOut", motionPath: { path: path("#path-tell"), align: path("#path-tell"), alignOrigin: [0.5, 0.5] } })
          .set(q(".pulse.p3"), { opacity: 0 });
      } else {
        tl.to({}, { duration: 1.2 });
      }
      tl.to(q(".live-toast"), { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "back.out(1.6)" })
        .to({}, { duration: 3.6 })
        .to(q(".tg-card, .tg-out, .term-line, .live-toast"), { opacity: 0, duration: 0.5 });
    }, root);
    return () => ctx.revert();
  }, [layout.mobile]);

  const w = layout.mobile ? MOBILE_W : STAGE_W;
  return (
    <div className="stage-outer" ref={outerRef} style={{ ["--s" as string]: layout.scale, height: STAGE_H * layout.scale }}>
      <div className="stage" ref={stageRef} style={{ width: w, height: STAGE_H }}>
        <div className="stage-panel" />
        {!layout.mobile && (
          <>
            <svg className="connectors" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} aria-hidden="true">
              <path id="path-ask" d="M416 300 C 392 300, 392 236, 368 236" />
              <path id="path-ship" d="M196 470 C 196 760, 690 770, 796 600" />
              <path id="path-tell" d="M796 676 C 786 690, 776 700, 764 700" />
              <circle className="pulse p1" r="6" />
              <circle className="pulse p2" r="6" />
              <circle className="pulse p3" r="6" />
            </svg>
            <TelegramCard />
            <Terminal />
          </>
        )}
        <div className="phone-tag" style={{ top: 34 }}>
          <Mark className="spot-mark" />
          The real YouAsked widget. Try it.
        </div>
        <div className="phone" style={{ left: (w - 348) / 2, top: 60 }}>
          <div className="phone-screen">
            <div className="island" />
            <div className="statusbar">
              <span>9:41</span>
              <span className="sb-icons">
                <i />
              </span>
            </div>
            <YouAsked demo cards={false} offset={84} trigger="none" appearance={APP_LOOK} appName="Acme" appIcon={false}>
              <FeatureBoard height="100%" className="phone-board" />
            </YouAsked>
            <div className="live-toast" aria-hidden="true">
              <div className="k">You asked for</div>
              <div className="t">Split a bill with my partner</div>
              <div className="l">
                <Check size={15} /> It's live
              </div>
              <div className="n">Tap any expense, then Split 50/50.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TelegramCard() {
  return (
    <div className="float-card tg" style={{ left: 24, top: 120, width: 344 }} aria-hidden="true">
      <div className="tg-head">
        <span className="tg-ava">G</span>
        <div>
          <div className="tg-name">Acme requests</div>
          <div className="tg-sub">bot · in your Telegram</div>
        </div>
      </div>
      <div className="tg-body">
        <div className="tg-card" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div className="tg-msg">
            💡 New request · <b>Acme</b> · YA-12<span className="tg-status" />
            <br />
            <b>Split a bill with my partner</b>
            <br />
            We share groceries and rent. Tag one as 50/50?
            <div className="tg-meta">Mei · 14 votes</div>
          </div>
          <div className="tg-keys">
            <span className="tg-planned">📌 Planned</span>
            <span>🛠 Doing</span>
            <span>✅ Shipped</span>
            <span className="wide">💬 Reply</span>
          </div>
        </div>
        <div className="tg-out">On it. Shipping this week 👍</div>
      </div>
    </div>
  );
}

function Terminal() {
  return (
    <div className="float-card term" style={{ left: 796, top: 470, width: 360 }} aria-hidden="true">
      <div className="term-bar">
        <i />
        <i />
        <i />
        <span>acme · main</span>
      </div>
      <div className="term-body">
        <div className="term-line l1">
          <span className="p">$ </span>
          <span className="term-typed" />
        </div>
        <div className="term-line l2">
          <span className="p">$ </span>
          <span className="term-typed" />
        </div>
        <div className="term-line l3 dim">→ youasked: YA-12 marked shipped</div>
        <div className="term-line l4 ok">✓ 15 people who asked were told</div>
      </div>
    </div>
  );
}
