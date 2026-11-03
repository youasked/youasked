export const SITE = "https://youasked.dev";
export const API = "https://api.youasked.dev";

/** Publishable key of the public demo app (sample Acme requests, anonymous visitors allowed). */
export const DEMO_KEY = "ya_pub_da93si9r7h98u8v8jta1t1v6";

export const INSTALL_CMD = "npx youasked init";
export const MCP_CMD = "claude mcp add youasked -e YOUASKED_SECRET_KEY=ya_sec_… -- npx -y @youasked/mcp";

export const AGENT_PROMPT = `Add YouAsked to this app so people can ask for features, vote, and hear when what they asked for ships.

Read ${SITE}/install.md and follow it from start to finish:
1. Before changing anything, work out the platforms (web, React Native or Expo, or both) and how the app is laid out.
2. Propose where the entry points should go and why, and whether users will be signed in. Wait for my OK, and ask me anything you can't tell from the code.
3. Set it up with \`npx youasked init\`, sign users on the server if the app has sign-in, and match our theme in light and dark.
4. Test every entry point on localhost or a dev build.
5. Finish with what changed, where each entry point lives, and what I need to do to go live.`;

/** Publishable key of YouAsked's own feedback board (the launcher on this site). */
export const SITE_KEY = "ya_pub_wq8adqwa8is82xem21onbhj5";
