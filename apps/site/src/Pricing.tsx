import { useState } from "react";
import { FaqList } from "./Sections";
import { PRICING_FAQ } from "./faq";
import {
  FOUNDING_SLOTS,
  GUARANTEE_DAYS,
  PLANS,
  PLAN_ORDER,
  comparisonRows,
  monthsFree,
  money,
  perMonth,
  planFeatures,
  price,
  type Interval,
} from "./plans-view";
import { PageHead } from "./Page";
import { Check, Reveal } from "./ui";

function Toggle({ value, onChange }: { value: Interval; onChange: (v: Interval) => void }) {
  return (
    <div className="seg" role="group" aria-label="Billing period">
      <button type="button" aria-pressed={value === "month"} onClick={() => onChange("month")}>
        Monthly
      </button>
      <button type="button" aria-pressed={value === "year"} onClick={() => onChange("year")}>
        Yearly <span className="seg-tag">2 months free</span>
      </button>
    </div>
  );
}

function Notes() {
  return (
    <ul className="plan-notes">
      <li>
        <b>Test it free.</b> Until you subscribe, YouAsked runs in test mode and answers only from localhost.
      </li>
      <li>
        <b>{GUARANTEE_DAYS}-day money-back guarantee.</b> Not for you? Get a refund, no questions asked.
      </li>
      <li>
        <b>No per-user pricing.</b> Unlimited end users, votes and requests on every plan.
      </li>
    </ul>
  );
}

/** The plan cards with the Monthly/Yearly toggle. Shared by the landing page and /pricing. */
export function Plans() {
  const [interval, setInterval] = useState<Interval>("month");
  return (
    <>
      <div className="plans-bar">
        <Toggle value={interval} onChange={setInterval} />
        <span className="founding-chip">
          <i /> Founding price for the first {FOUNDING_SLOTS} workspaces, locked while you stay subscribed
        </span>
      </div>
      <div className="plans">
        {PLAN_ORDER.map((key) => {
          const p = PLANS[key];
          const founding = price(key, interval, true);
          const regular = price(key, interval, false);
          return (
            <div className="plan" key={key} data-plan={key}>
              <div className="plan-top">
                <span className="name">{p.name}</span>
                <span className="founding-badge">Founding price</span>
              </div>
              <div className="plan-amt">
                <span className="amt">
                  {money(founding)}
                  <small>/{interval === "month" ? "month" : "year"}</small>
                </span>
                <span className="was">
                  <s>{money(regular)}</s> regular
                </span>
              </div>
              <p className="plan-sub">
                {interval === "year"
                  ? `${money(perMonth(founding))} a month, billed yearly. ${monthsFree(key)} months free.`
                  : "Billed monthly. Cancel any time."}
              </p>
              <ul>
                {planFeatures(key).map((f) => (
                  <li key={f}>
                    <Check size={18} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** The pricing section of the landing page. */
export function Pricing() {
  return (
    <section className="section" id="pricing">
      <div className="wrap">
        <Reveal className="section-head">
          <h2 className="h2">One flat price. Unlimited users.</h2>
          <p className="lede">No per-seat or per-user pricing, and no free tier to outgrow. Try it on localhost first, then pick a plan.</p>
        </Reveal>
        <Reveal>
          <Plans />
          <Notes />
          <p className="plans-more">
            <a href="/pricing">Compare every feature and read the pricing FAQ</a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function PricingPage() {
  const rows = comparisonRows();
  return (
    <>
      <PageHead
        eyebrow="Pricing"
        title="Flat plans. Unlimited users and votes."
        lede="Pay for your apps, not for how many people use them. Install and try YouAsked on localhost for free, then pick a plan when you're ready to go live."
      />
      <section className="page-section">
        <div className="wrap">
          <Plans />
          <Notes />
        </div>
      </section>
      <section className="page-section">
        <div className="wrap">
          <h2 className="h3 page-h">Compare the plans</h2>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr">Feature</span>
                  </th>
                  {PLAN_ORDER.map((k) => (
                    <th scope="col" key={k}>
                      {PLANS[k].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">
                      {r.label}
                      {r.note && <small>{r.note}</small>}
                    </th>
                    {r.values.map((v, i) => (
                      <td key={i} data-v={v}>
                        {v === "Yes" ? <Check size={16} /> : v}
                        {v === "Yes" && <span className="sr">Yes</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fine">
            Prices in US dollars. Founding prices: {money(price("solo", "month", true))}, {money(price("pro", "month", true))} and{" "}
            {money(price("studio", "month", true))} a month for the first {FOUNDING_SLOTS} paying workspaces, locked for as long as they stay subscribed. Regular
            prices are {money(price("solo", "month", false))}, {money(price("pro", "month", false))} and {money(price("studio", "month", false))} a month.
            Yearly is {monthsFree("solo")} months free.
          </p>
        </div>
      </section>
      <section className="page-section">
        <div className="narrow">
          <h2 className="h3 page-h">Pricing questions</h2>
          <FaqList items={PRICING_FAQ} />
        </div>
      </section>
    </>
  );
}
