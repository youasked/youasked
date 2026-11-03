// The code and docs `init` writes into a project.

/** Drops TypeScript-only syntax from a template so the same source serves .jsx projects. */
const forJs = (/** @type {string} */ code) =>
  code
    .replace(/^import type .*\n/gm, "")
    .replace(/^type Identity = .*\n\n/m, "")
    .replace(", type ReactNode", "")
    .replace(/\{ children \}: \{ children: ReactNode \}/g, "{ children }")
    .replace(/useState<[^>]*>\(/g, "useState(")
    .replace(/!\}/g, "}");

/**
 * The provider wrapper that goes around the app.
 * @param {{ keyExpr: string, apiExpr: string | null, ts: boolean, next: boolean, identity: boolean, floating: boolean, identityPath: string }} o
 */
export function providerComponent(o) {
  const lines = [];
  if (o.next) lines.push('"use client";', "");
  lines.push(
    o.identity ? 'import { useEffect, useState, type ReactNode } from "react";' : 'import type { ReactNode } from "react";',
    'import { YouAsked } from "@youasked/react";',
  );
  if (o.identity) lines.push('import type { YouAskedUser } from "@youasked/react";');
  lines.push("");
  if (o.identity) {
    lines.push(
      "type Identity = { user: YouAskedUser; signature: string };",
      "",
      `// Asks your server who is signed in (see ${o.identityPath}). Signed-out visitors stay anonymous.`,
    );
  }
  lines.push("export function FeatureRequests({ children }: { children: ReactNode }) {");
  if (o.identity) {
    lines.push(
      "  const [identity, setIdentity] = useState<Identity | null | undefined>(undefined);",
      "",
      "  useEffect(() => {",
      '    fetch("/api/youasked/identity")',
      "      .then((r) => (r.ok ? r.json() : null))",
      "      .then(setIdentity)",
      "      .catch(() => setIdentity(null));",
      "  }, []);",
      "",
    );
  }
  lines.push("  return (", "    <YouAsked", `      appKey={${o.keyExpr}!}`);
  if (o.apiExpr) lines.push(`      apiUrl={${o.apiExpr}}`);
  if (!o.floating) lines.push('      trigger="none"');
  if (o.identity) lines.push("      user={identity?.user}", "      signature={identity?.signature}", "      ready={identity !== undefined}");
  lines.push("    >", "      {children}", "    </YouAsked>", "  );", "}", "");
  const code = lines.join("\n");
  return o.ts ? code : forJs(code);
}

const USER_TYPE = ": Promise<{ id: string; email?: string; name?: string } | null>";

/** Next.js app router: GET /api/youasked/identity → { user, signature } for whoever is signed in. */
export function identityRouteApp(/** @type {boolean} */ ts) {
  const code = `import { signUser } from "@youasked/react/server";

// Signed identities mean nobody can vote or post as someone else.
// Return the signed-in user (id is required; email and name are optional), or null when signed out.
// TODO: replace this with however your app reads its session (NextAuth, Clerk, Supabase, …).
async function getCurrentUser(): Promise<{ id: string; email?: string; name?: string } | null> {
  return null;
}

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json(null, { status: 401 });
  const signature = await signUser(process.env.YOUASKED_SECRET_KEY!, user.id);
  return Response.json({ user, signature });
}
`;
  return ts ? code : code.replace(USER_TYPE, "").replace(/!,/, ",");
}

/** Next.js pages router flavour of the same endpoint. */
export function identityRoutePages(/** @type {boolean} */ ts) {
  const code = `import type { NextApiRequest, NextApiResponse } from "next";
import { signUser } from "@youasked/react/server";

// Signed identities mean nobody can vote or post as someone else.
// Return the signed-in user (id is required; email and name are optional), or null when signed out.
// TODO: replace this with however your app reads its session (NextAuth, Clerk, Supabase, …).
async function getCurrentUser(req: NextApiRequest): Promise<{ id: string; email?: string; name?: string } | null> {
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json(null);
  const signature = await signUser(process.env.YOUASKED_SECRET_KEY!, user.id);
  res.status(200).json({ user, signature });
}
`;
  return ts
    ? code
    : code
        .replace(/^import type .*\n/m, "")
        .replace(/req: NextApiRequest, res: NextApiResponse/, "req, res")
        .replace(`(req: NextApiRequest)${USER_TYPE}`, "(req)")
        .replace(/!,/, ",");
}

export const feedbackPageApp = `import { FeatureBoard } from "@youasked/react";

export const metadata = { title: "Feature requests" };

export default function FeedbackPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
      <FeatureBoard />
    </main>
  );
}
`;

export const feedbackPagePages = `import { FeatureBoard } from "@youasked/react";

export default function FeedbackPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
      <FeatureBoard />
    </main>
  );
}
`;

/** Copy-paste snippets for the entry points that belong somewhere only you know. */
export const entrySnippets = {
  askbar: { import: "AskBar", jsx: "<AskBar />", what: "ask bar (a chat-style input that opens the composer)" },
  card: { import: "FeatureCard", jsx: "<FeatureCard />", what: "feature card (top requests with vote buttons)" },
  settings: { import: "RequestButton", jsx: '<RequestButton variant="row" />', what: "settings row" },
  page: { import: "FeatureBoard", jsx: "<FeatureBoard />", what: "embedded page" },
};

export const AGENTS_MARKER = "## YouAsked";

export const agentsSection = `${AGENTS_MARKER}

Feature requests from our users live in YouAsked. Requests have numbers like YA-12.

- To ship a request, put "closes YA-12" in the commit message or PR title. The GitHub webhook marks it shipped and tells everyone who asked.
- With the YouAsked MCP server (\`@youasked/mcp\`), use \`list_requests\` to see what people want most, \`get_request\` for the details, and \`reply\` to answer them.
- See \`.claude/skills/youasked/SKILL.md\` for how to add entry points.
`;

export const skillMd = `---
name: youasked
description: Work with YouAsked feature requests in this project. Use when the user mentions feature requests, votes, "what are users asking for", a YA-12 style number, shipping a request, or adding a "request a feature" button, ask bar or feedback page.
---

# YouAsked

YouAsked collects feature requests from this app's users. They vote, and when something ships they see "You asked, it's live". Each request has a number like **YA-12**.

## Add an entry point

The provider (\`FeatureRequests\` in \`components/feature-requests\`, or wherever \`npx youasked init\` put it) already wraps the app. Any of these can go anywhere inside it:

\`\`\`tsx
import { AskBar, FeatureCard, RequestButton, FeatureBoard } from "@youasked/react";

<AskBar />                          // chat-style input; good at the top of a home screen
<FeatureCard />                     // top requests with vote buttons; good on a dashboard
<RequestButton variant="row" />     // settings-style row ("pill" and "icon" also exist, e.g. for a header)
<FeatureBoard />                    // the whole thing inline, for a /feedback page or a tab
\`\`\`

The floating launcher is the \`<YouAsked>\` provider itself. Pass \`trigger="none"\` to hide it when you use the inline ones. From code: \`useYouAsked().open()\` or \`openYouAsked()\`.

Keys live in env vars (\`NEXT_PUBLIC_YOUASKED_KEY\` / \`VITE_YOUASKED_KEY\` for the publishable key, \`YOUASKED_SECRET_KEY\` for the secret). Never put the secret key in client code or commit it.

## Read and ship requests (MCP)

If the \`youasked\` MCP server is connected (\`claude mcp add youasked -e YOUASKED_SECRET_KEY=ya_sec_… -- npx -y @youasked/mcp\`), the usual loop is:

1. \`list_requests\` (sort by votes) or \`digest\` to see what people want most.
2. \`get_request\` on the one to build: read the full text and the comments.
3. Implement it.
4. Commit with **"closes YA-12"** in the message (or the PR title). The GitHub webhook marks it shipped and notifies everyone who asked or voted. No GitHub webhook? Call \`set_status\` with \`shipped\` and a short ship note instead, written for users ("Find it in Settings → Appearance.").
5. \`reply\` to answer people along the way. Replies show up inside the app for the people who asked.

Other tools: \`search\` finds near-duplicates before you act, \`merge\` folds a duplicate (YA-a) into the main request (YA-b) and keeps the votes.

## Rules of thumb

- Plain-English ship notes. Say where to find the thing, not how it works.
- Merge duplicates before building so the votes add up.
- Don't mark something shipped until it is actually released.
`;
