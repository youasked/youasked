// Every page of the site: its URL, search-result title and description, component and structured data.
// The browser picks the page from this list, and the build pre-renders each one to its own HTML file.
import type { ComponentType } from "react";
import { AlternativesPage, CANNY_FAQ, CannyPage, FEATUREBASE_FAQ, FeaturebasePage, HUB_FAQ } from "./Alternatives";
import { ChangelogPage, ENTRIES } from "./ChangelogPage";
import { DocsPage } from "./Docs";
import { Home } from "./Home";
import { HomeV3 } from "./v3/HomeV3";
import { PrivacyPage, TermsPage } from "./Legal";
import { MCP_FAQ, McpPage } from "./McpPage";
import { NotFoundPage } from "./NotFound";
import { crumbsFor } from "./Page";
import { PricingPage } from "./Pricing";
import { SITE } from "./content";
import { LANDING_FAQ, PRICING_FAQ, type Faq } from "./faq";
import { PLANS, PLAN_ORDER, price } from "./plans-view";

export type Route = {
  path: string;
  title: string;
  description: string;
  component: ComponentType;
  /** Questions shown on the page, also emitted as FAQPage structured data. */
  faq?: Faq[];
  /** Left out of the sitemap and told not to be indexed. */
  hidden?: boolean;
  /** Priority hint for the sitemap. */
  priority?: number;
  /** The page brings its own nav and footer. */
  bare?: boolean;
};

export const ROUTES: Route[] = [
  {
    path: "/",
    title: "YouAsked: in-app feature requests that tell users when you ship",
    description:
      "Feature requests inside your React and React Native apps. Users ask and vote, you hear it on Telegram, Slack or Discord, and everyone who asked is told when you ship.",
    component: HomeV3,
    faq: LANDING_FAQ,
    priority: 1,
    bare: true,
  },
  {
    // The previous homepage, kept for comparison.
    path: "/lab/classic",
    title: "YouAsked (previous homepage)",
    description: "The previous YouAsked homepage.",
    component: Home,
    hidden: true,
  },
  {
    path: "/pricing",
    title: "YouAsked pricing: flat plans, unlimited users and votes",
    description:
      "Solo, Pro and Studio plans with unlimited users and votes. Founding prices, free test mode on localhost and a 14-day money-back guarantee.",
    component: PricingPage,
    faq: PRICING_FAQ,
    priority: 0.9,
  },
  {
    path: "/docs",
    title: "YouAsked docs: install, entry points, identity, theming and MCP",
    description:
      "Add feature requests to a React or Next.js app: install, pick entry points, sign users, match your theme, connect Telegram and GitHub, ship with a commit.",
    component: DocsPage,
    priority: 0.9,
  },
  {
    path: "/mcp",
    title: "User feedback MCP server for Claude Code, Cursor and Codex | YouAsked",
    description:
      "An MCP server that lets your coding agent list user feature requests, read them, reply and mark them shipped. One line to add to Claude Code, Cursor or Codex.",
    component: McpPage,
    faq: MCP_FAQ,
    priority: 0.8,
  },
  {
    path: "/alternatives",
    title: "Feature request tool alternatives compared | YouAsked",
    description:
      "Canny, Featurebase, UserJot, Frill, Nolt, Upvoty, Sleekplan and open-source options compared honestly, with prices checked in November 2026 and where YouAsked fits.",
    component: AlternativesPage,
    faq: HUB_FAQ,
    priority: 0.8,
  },
  {
    path: "/alternatives/canny",
    title: "Canny alternative: YouAsked vs Canny pricing and features",
    description:
      "Canny charges by tracked users; YouAsked is flat with unlimited users and votes. An honest comparison of pricing, in-app widgets, agents and MCP, and where Canny is the better pick.",
    component: CannyPage,
    faq: CANNY_FAQ,
    priority: 0.8,
  },
  {
    path: "/vs/featurebase",
    title: "YouAsked vs Featurebase: pricing, features and where each wins",
    description:
      "Featurebase prices per seat and per AI resolution; YouAsked is one flat plan. Compare pricing, scope, MCP and in-app feedback, and see where Featurebase is the better fit.",
    component: FeaturebasePage,
    faq: FEATUREBASE_FAQ,
    priority: 0.8,
  },
  {
    path: "/changelog",
    title: "YouAsked changelog: what we shipped",
    description: "What's new in YouAsked, newest first: public boards, share cards, pricing and more.",
    component: ChangelogPage,
    priority: 0.5,
  },
  {
    path: "/privacy",
    title: "Privacy policy | YouAsked",
    description: "What YouAsked collects from developers and from the people who use apps with YouAsked, who processes it, and how to access, export or delete it.",
    component: PrivacyPage,
    priority: 0.3,
  },
  {
    path: "/terms",
    title: "Terms of service | YouAsked",
    description: "The terms for using YouAsked: subscriptions, the 14-day money-back guarantee, acceptable use, liability and governing law.",
    component: TermsPage,
    priority: 0.3,
  },
];

export const NOT_FOUND: Route = {
  path: "/404",
  title: "Page not found | YouAsked",
  description: "That page doesn't exist. Head back to YouAsked.",
  component: NotFoundPage,
  hidden: true,
};

export function routeFor(pathname: string): Route {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return ROUTES.find((r) => r.path === path) ?? NOT_FOUND;
}

/* ---------------------------------------------------------------- structured data */

const abs = (path: string) => `${SITE}${path === "/" ? "/" : path}`;

function offers() {
  return PLAN_ORDER.flatMap((k) =>
    (["month", "year"] as const).map((interval) => ({
      "@type": "Offer",
      name: `${PLANS[k].name} (${interval === "month" ? "monthly" : "yearly"})`,
      price: String(price(k, interval, false)),
      priceCurrency: "USD",
      url: `${SITE}/pricing`,
      availability: "https://schema.org/InStock",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: String(price(k, interval, false)),
        priceCurrency: "USD",
        billingDuration: 1,
        unitCode: interval === "month" ? "MON" : "ANN",
      },
    })),
  );
}

export function jsonLdFor(route: Route): object[] {
  const out: object[] = [];
  if (route.path === "/") {
    out.push(
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "YouAsked",
        url: SITE,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        description: route.description,
        image: `${SITE}/og.png`,
        offers: offers(),
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "YouAsked",
        url: SITE,
        logo: `${SITE}/apple-touch-icon.png`,
        sameAs: ["https://github.com/youasked/youasked", "https://www.npmjs.com/package/@youasked/react"],
      },
    );
  } else {
    const crumbs = crumbsFor(route.path);
    if (crumbs.length) {
      out.push({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [["YouAsked", "/"], ...crumbs].map(([name, href], i) => ({
          "@type": "ListItem",
          position: i + 1,
          name,
          item: abs(href),
        })),
      });
    }
    if (route.path === "/pricing") {
      out.push({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "YouAsked",
        url: SITE,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        offers: offers(),
      });
    }
    if (route.path === "/changelog") {
      out.push({
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "YouAsked changelog",
        itemListElement: ENTRIES.map((e, i) => ({ "@type": "ListItem", position: i + 1, name: e.title })),
      });
    }
  }
  if (route.faq?.length) {
    out.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: route.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
  }
  return out;
}
