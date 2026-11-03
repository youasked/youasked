export const SITE = "https://youasked.adenteo.workers.dev";
export const API = "https://youasked-api.adenteo.workers.dev";

/** Publishable key of the public demo app (sample Acme requests, anonymous visitors allowed). */
export const DEMO_KEY = "ya_pub_da93si9r7h98u8v8jta1t1v6";

export const INSTALL_CMD = "npx youasked init";
export const MCP_CMD = "claude mcp add youasked -e YOUASKED_SECRET_KEY=ya_sec_… -- npx -y @youasked/mcp";

export const AGENT_PROMPT = `Add YouAsked to this app so people can request features, vote, and hear when they ship.

1. Read ${SITE}/install.md
2. Run \`npx youasked init\` and choose entry points that fit this UI: an ask bar on the home screen, a button in the header, or a row in settings.
3. If the app has sign-in, sign each user on the server with signUser from @youasked/react/server, so nobody can vote as someone else.
4. Match our colours with the appearance prop, then show me where each entry point went.`;

/** Publishable key of YouAsked's own feedback board (the launcher on this site). */
export const SITE_KEY = "ya_pub_wq8adqwa8is82xem21onbhj5";
