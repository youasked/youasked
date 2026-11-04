import { useEffect, useRef, useState } from "react";
import { FOUNDING_SLOTS, PLANS, PRICES } from "../../../api/src/plans";
import { api, type Interval, type Plan } from "../api";
import { mockEnabled } from "../mock";
import { navigate, useRoute } from "../router";
import { useSession } from "../session";
import { Button, Icon, PageHead, shortDate, useFail } from "../ui";

const ORDER: Plan[] = ["solo", "pro", "studio"];
const BLURB: Record<Plan, string> = {
  solo: "One app, just you.",
  pro: "A few apps and a small team.",
  studio: "Every app you ship, with your team.",
};

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

export function Billing() {
  const { ws, wid, reloadWs } = useSession();
  const { query } = useRoute();
  const w = ws!;
  const cur = w.workspace;
  const [interval, setInterval_] = useState<Interval>(cur.interval ?? "year");
  const [busy, setBusy] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(query.get("checkout") === "success");
  const [canceled, setCanceled] = useState(query.get("checkout") === "canceled");
  const fail = useFail();

  // Stripe sends people back here after paying. The webhook can lag a moment, so look a few times.
  const poll = useRef<number>(undefined);
  const flag = query.get("checkout");
  useEffect(() => {
    if (flag === "canceled") {
      setCanceled(true);
      navigate("/billing", true);
      return;
    }
    if (flag !== "success") return;
    setJustPaid(true);
    navigate("/billing", true);
    let n = 0;
    reloadWs();
    window.clearInterval(poll.current);
    poll.current = window.setInterval(() => {
      if (++n > 5) return window.clearInterval(poll.current);
      reloadWs();
    }, 2000);
  }, [flag]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => window.clearInterval(poll.current), []);

  const founding = cur.founding || w.foundingLeft > 0;
  const go = (url: string) => {
    if (mockEnabled()) {
      const u = new URL(url, location.origin);
      navigate(u.pathname + u.search);
    } else location.href = url;
  };

  const checkout = async (plan: Plan) => {
    setBusy(plan);
    try {
      const { url } = await api<{ url: string }>(`/v1/dash/workspaces/${wid}/checkout`, { method: "POST", body: { plan, interval } });
      go(url);
    } catch (e) {
      fail(e);
      setBusy(null);
    }
  };
  const portal = async () => {
    setBusy("portal");
    try {
      const { url } = await api<{ url: string }>(`/v1/dash/workspaces/${wid}/portal`, { method: "POST" });
      go(url);
    } catch (e) {
      fail(e);
      setBusy(null);
    }
  };

  return (
    <div className="page">
      <PageHead title="Billing" sub={`Plans for ${cur.name}. Unlimited users and votes on every plan.`} />

      {canceled && !cur.live && <div className="success-bar canceled" role="status">Checkout was canceled, so you weren't charged. Pick a plan whenever you're ready.</div>}
      {justPaid && cur.live && (
        <div className="success-bar" role="status">
          <Icon name="check" size={16} /> <b>You're all set.</b> {PLANS[cur.plan!].name} is active, and your apps are live for everyone.
        </div>
      )}
      {justPaid && !cur.live && (
        <div className="success-bar" role="status"><span className="spinner" /> Thanks. We're confirming your payment, this takes a few seconds.</div>
      )}

      <section className="current">
        {cur.live && cur.plan ? (
          <>
            <div>
              <h2>{PLANS[cur.plan].name} <span className="muted">{cur.interval === "year" ? "billed yearly" : "billed monthly"}</span>{cur.founding && <span className="badge-founding">Founding price</span>}</h2>
              <p className="muted">
                {cur.status === "past_due" ? "Your last payment didn't go through. Update your card to keep things running. " : ""}
                {cur.currentPeriodEnd ? `Renews on ${shortDate(cur.currentPeriodEnd)}.` : ""} Change plan below, or manage cards, invoices and cancellation in the billing portal.
              </p>
            </div>
            <Button busy={busy === "portal"} onClick={portal}><Icon name="card" size={16} /> Manage billing</Button>
          </>
        ) : (
          <div>
            <h2>Test mode</h2>
            <p className="muted">YouAsked works on localhost until you pick a plan. After that, your apps answer on your real website too.</p>
          </div>
        )}
      </section>

      <div className="plans-head">
        <div className="seg" role="group" aria-label="Billing interval">
          <button data-on={interval === "month" || undefined} onClick={() => setInterval_("month")}>Monthly</button>
          <button data-on={interval === "year" || undefined} onClick={() => setInterval_("year")}>Yearly <span className="free">{Math.round((PRICES.solo.month * 12 - PRICES.solo.year) / PRICES.solo.month)} months free</span></button>
        </div>
        {w.foundingLeft > 0 && !cur.founding && (
          <p className="founding" role="note">
            <span className="spark"><Icon name="spark" size={15} /></span>
            <b>Founding price:</b> {w.foundingLeft} of {FOUNDING_SLOTS} founding spots left. It's locked for as long as you stay subscribed.
          </p>
        )}
      </div>

      <ul className="plans">
        {ORDER.map((p) => {
          const L = PLANS[p];
          const price = PRICES[p];
          const list = price[interval];
          const now = founding ? price.founding[interval] : list;
          const isCurrent = cur.live && cur.plan === p && cur.interval === interval;
          const sameButOtherInterval = cur.live && cur.plan === p && !isCurrent;
          return (
            <li key={p} data-current={isCurrent || undefined} data-feature={p === "pro" || undefined}>
              <div className="plan-name">
                <h3>{L.name}</h3>
                <p className="muted">{BLURB[p]}</p>
              </div>
              <div className="plan-price">
                <b>{money(interval === "year" ? now / 12 : now)}</b>
                <span>/month</span>
                {(interval === "year" || founding) && price.month > (interval === "year" ? now / 12 : now) && <s>{money(price.month)}</s>}
                {interval === "year" ? (
                  <small>
                    <strong>{money(now)} billed yearly.</strong> You save {money(price.month * 12 - now)} a year.
                  </small>
                ) : (
                  founding && <small>Founding price, billed monthly.</small>
                )}
              </div>
              <ul className="plan-feats">
                <li>{Number.isFinite(L.apps) ? `${L.apps} ${L.apps === 1 ? "app" : "apps"}` : "Unlimited apps"}</li>
                <li>{L.members} {L.members === 1 ? "team member" : "team members"}</li>
                <li>{L.listeningApps ? `Heard elsewhere on ${L.listeningApps} ${L.listeningApps === 1 ? "app" : "apps"}` : "Telegram, Slack, Discord, GitHub"}</li>
                <li>{L.removeBranding ? "Remove the YouAsked line" : "Shows the YouAsked line"}</li>
              </ul>
              <div className="plan-cta">
                {isCurrent ? (
                  <span className="current-tag"><Icon name="check" size={15} /> Your plan</span>
                ) : (
                  <Button kind={p === "pro" ? "primary" : "default"} busy={busy === p} onClick={() => checkout(p)}>
                    {sameButOtherInterval ? `Switch to ${interval === "year" ? "yearly" : "monthly"}` : cur.live ? `Switch to ${L.name}` : `Choose ${L.name}`}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="guarantee"><Icon name="check" size={15} /> 14-day money-back guarantee. Not for you? Email us within 14 days and we refund you, no questions.</p>
    </div>
  );
}
