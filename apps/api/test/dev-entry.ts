// Test-only entry: the real worker with a fake Workers AI binding, so `wrangler dev --local` can run
// the AI paths (listening, build-prompt refinement, digest summary) without calling Cloudflare.
import worker from "../src/index";
import type { Env } from "../src/types";

const REQUEST_WORDS = /\b(wish|please add|i need|i'd also love|would love|would pay|no home screen|needs a|should have|missing)\b/i;
const ON_TOPIC = /\b(habit|streak|tracker|widget|offline|export|csv|check-in)\b/i;
const OFF_TOPIC = /\b(weather|brokerage|options|stock|radar)\b/i;

const fakeAI = {
  async run(_model: string, input: { messages: { role: string; content: string }[]; response_format?: { json_schema?: { properties?: Record<string, unknown> } } }) {
    const props = input.response_format?.json_schema?.properties ?? {};
    const user = input.messages.at(-1)?.content ?? "";
    if ("isRequest" in props) {
      const isRequest = REQUEST_WORDS.test(user);
      const relevantToApp = ON_TOPIC.test(user) && !OFF_TOPIC.test(user);
      const text = user.split("\n\n").slice(1).join(" ");
      const feature = /csv|export/i.test(text) ? "Export streaks to CSV" : /offline/i.test(text) ? "Offline mode" : /widget/i.test(text) ? "Home screen widget" : "Something";
      return { response: { isRequest, relevantToApp, feature, strength: /pay|please/i.test(user) ? 3 : 2 } };
    }
    if ("summary" in props) {
      return {
        response: {
          summary: "Users want to keep their data portable and usable without a connection.",
          acceptance: ["Works with no network and syncs when back online", "No streak is lost during an offline day", "Offline state is visible in the UI"],
          notes: ["Resolve conflicts if two devices edit the same day"],
        },
      };
    }
    return { response: "Most asks this week are about working offline and exporting data; two people want a home screen widget." };
  },
};

const withAI = (env: Env): Env => ({ ...env, AI: fakeAI as unknown as Ai });

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) => worker.fetch(req, withAI(env), ctx),
  scheduled: (event: ScheduledController, env: Env, ctx: ExecutionContext) => worker.scheduled(event, withAI(env), ctx),
};
