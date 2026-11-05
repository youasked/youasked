import { FOUNDING_SLOTS, GUARANTEE_DAYS } from "./plans-view";

export type Faq = { q: string; a: string };

const FREE_PLAN: Faq = {
  q: "Is there a free plan?",
  a: `No. You can install YouAsked and try it in your own app for free: until you subscribe it runs in test mode, which answers only from localhost. When you're ready to go live, pick a plan. Every plan has a ${GUARANTEE_DAYS}-day money-back guarantee, no questions asked. We don't run a free tier because free apps cost real money here (AI, screenshots, notifications) and we'd rather keep the price flat and low.`,
};

const SELF_HOST: Faq = {
  q: "Can I self-host?",
  a: "Yes. The server is source-available under FSL-1.1-MIT: you can read it, run it and self-host it for your own apps, but not offer it as a competing hosted service. Each release becomes plain MIT two years after it ships. The React widget, the CLI and the MCP server are MIT from day one.",
};

const TEST_MODE: Faq = {
  q: "What is test mode?",
  a: "Before you subscribe, your app answers widget requests only from local origins (localhost, 127.0.0.1 and *.localhost). That means you can install YouAsked, see it in your own app and send yourself a test request without paying. Visitors on your real domain see nothing until a plan is active.",
};

const FOUNDING: Faq = {
  q: "What is the founding price?",
  a: `The first ${FOUNDING_SLOTS} paying workspaces get a lower price that is locked for as long as they stay subscribed. After that the regular price applies to new subscribers. It's simpler and safer than a lifetime deal.`,
};

const GUARANTEE: Faq = {
  q: "How does the money-back guarantee work?",
  a: `If YouAsked isn't for you, tell us within ${GUARANTEE_DAYS} days of paying and we refund the payment. No questions asked.`,
};

const NO_PER_USER: Faq = {
  q: "Do you charge per user, seat or vote?",
  a: "No. Plans are flat. End users, voters and requests are unlimited on every plan. Team members are capped per plan so the price stays predictable.",
};

export const LANDING_FAQ: Faq[] = [
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
    a: "The web (React, Next.js, and a script tag for Vue, Svelte, Angular, Nuxt, Astro, plain HTML, Webflow and WordPress), React Native and Expo, native iOS in Swift and SwiftUI, and native Android in Kotlin and Jetpack Compose. They all share one board, so a request from your iPhone app and one from your website add up. Flutter is coming next.",
  },
  {
    q: "Do I have to use Telegram?",
    a: "No. Telegram gives you buttons to act on requests. Slack and Discord get a message for each request, and the web dashboard works anywhere.",
  },
  FREE_PLAN,
  SELF_HOST,
];

export const PRICING_FAQ: Faq[] = [FREE_PLAN, TEST_MODE, FOUNDING, GUARANTEE, NO_PER_USER, SELF_HOST];
