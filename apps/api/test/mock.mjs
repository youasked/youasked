// Local stand-in for Telegram, GitHub, iTunes reviews and ScrapeCreators, for `wrangler dev --local`.
//   node apps/api/test/mock.mjs        (port 9911)
// Telegram calls are recorded; read them with GET /_calls and clear with POST /_reset.
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 9911);
let calls = [];
let messageId = 100;
let issueNo = 0;

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const read = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();
const epoch = (daysAgo) => Math.floor((Date.now() - daysAgo * 86400000) / 1000);

const POSTS = [
  {
    id: "p1",
    title: "Wish my habit tracker app had an offline mode",
    selftext: "I lose my streak whenever I'm on the subway. Please add offline support so habit check-ins sync later.",
    url: "https://www.reddit.com/r/productivity/comments/p1/offline_habit/",
    subreddit: "productivity",
    author: "subway_sam",
    num_comments: 12,
    created_utc: epoch(1),
  },
  {
    id: "p2",
    title: "Best brokerage app for options? I wish they had lower fees",
    selftext: "Looking at three brokerages and none of them has a decent mobile app.",
    url: "https://www.reddit.com/r/investing/comments/p2/brokerage/",
    subreddit: "investing",
    author: "options_guy",
    num_comments: 4,
    created_utc: epoch(2),
  },
  {
    id: "p3",
    title: "Weather app needs a radar widget",
    selftext: "My weather app should have a rain radar widget on the lock screen.",
    url: "https://www.reddit.com/r/weather/comments/p3/radar/",
    subreddit: "weather",
    author: "stormy",
    num_comments: 1,
    created_utc: epoch(2),
  },
  {
    id: "p4",
    title: "Weekly habit check-in thread",
    selftext: "How is everyone doing this week?",
    url: "https://www.reddit.com/r/productivity/comments/p4/weekly/",
    subreddit: "productivity",
    author: "mod",
    num_comments: 2,
    created_utc: epoch(3),
  },
];

const COMMENTS = [
  {
    id: "c1",
    url: "https://www.reddit.com/r/productivity/comments/p1/comment/c1/",
    author: "csv_carla",
    body: "Same here. I'd also love to export my habit streaks to CSV, I need that for my own tracking spreadsheet.",
    created_utc: epoch(1),
  },
  { id: "c2", url: "https://www.reddit.com/r/productivity/comments/p1/comment/c2/", author: "thx", body: "Thanks for sharing, this thread is really helpful for everyone.", created_utc: epoch(1) },
];

const REVIEWS = [
  { id: "r1", rating: "5", title: "Great", content: "Love this app, it is great and easy to use every single day.", author: "happy" },
  { id: "r2", rating: "3", title: "Needs a widget", content: "Good habit tracker but there is no home screen widget, I would pay for one. Please add a widget.", author: "wanda" },
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const body = await read(req);

  if (path === "/_calls") return json(res, 200, calls);
  if (path === "/_reset") {
    calls = [];
    return json(res, 200, { ok: true });
  }

  // Telegram: /bot<token>/<method>
  const tg = /^\/bot([^/]+)\/(\w+)$/.exec(path);
  if (tg) {
    const [, token, method] = tg;
    const type = req.headers["content-type"] || "";
    let payload;
    if (type.startsWith("application/json")) payload = JSON.parse(body.toString() || "{}");
    else {
      const text = body.toString("latin1");
      payload = { multipart: true, fields: [...text.matchAll(/name="(\w+)"(?:; filename="([^"]*)")?/g)].map((m) => m[2] ? `${m[1]}(file:${m[2]})` : m[1]), bytes: body.length };
      const cap = /name="caption"\r\n\r\n([^\r]*)/.exec(text);
      if (cap) payload.caption = cap[1];
    }
    const mid = /^(sendMessage|sendPhoto|sendDocument)$/.test(method) ? ++messageId : undefined;
    calls.push({ kind: "telegram", bot: token.slice(0, 4), method, payload, mid });
    if (method === "getMe") return json(res, 200, { ok: true, result: { id: 1, username: `own_${token.slice(0, 3)}_bot` } });
    if (method === "getChat") return json(res, 200, { ok: true, result: { id: payload.chat_id, title: "Notify chat" } });
    if (/^(sendMessage|sendPhoto|sendDocument)$/.test(method)) return json(res, 200, { ok: true, result: { message_id: mid } });
    return json(res, 200, { ok: true, result: true });
  }

  // GitHub
  if (path.startsWith("/gh/")) {
    const auth = req.headers.authorization;
    const sub = path.slice(3);
    if (auth !== "Bearer ghp_goodtoken") return json(res, 401, { message: "Bad credentials" });
    if (req.method === "GET" && /^\/repos\/[\w.-]+\/[\w.-]+$/.test(sub)) {
      if (sub === "/repos/acme/missing") return json(res, 404, { message: "Not Found" });
      return json(res, 200, { full_name: sub.slice(7), has_issues: true, default_branch: "main", permissions: { push: true } });
    }
    if (req.method === "GET" && /^\/repos\/[\w.-]+\/[\w.-]+$/.test(sub) === false && sub.endsWith("/contents/.github/workflows")) {
      return json(res, 200, [{ name: "claude.yml", path: ".github/workflows/claude.yml", type: "file" }]);
    }
    if (req.method === "GET" && sub.endsWith("/contents/.github/workflows/claude.yml")) {
      return json(res, 200, { content: Buffer.from("name: Claude\njobs:\n  claude:\n    steps:\n      - uses: anthropics/claude-code-action@v1\n").toString("base64") });
    }
    if (req.method === "POST" && /\/issues\/\d+\/assignees$/.test(sub)) {
      const payload = JSON.parse(body.toString());
      calls.push({ kind: "github", method: "assign", payload });
      const copilot = (payload.assignees ?? []).includes("copilot-swe-agent[bot]");
      return json(res, 201, { assignees: copilot ? [{ login: "Copilot" }] : [] });
    }
    if (req.method === "POST" && /\/issues\/\d+\/comments$/.test(sub)) {
      const payload = JSON.parse(body.toString());
      calls.push({ kind: "github", method: "comment", payload });
      return json(res, 201, { id: 1 });
    }
    if (req.method === "POST" && sub.endsWith("/issues")) {
      const payload = JSON.parse(body.toString());
      calls.push({ kind: "github", method: "createIssue", payload: { title: payload.title, labels: payload.labels, bodyLength: payload.body.length, bodyHead: payload.body.slice(0, 80) } });
      issueNo += 1;
      return json(res, 201, { html_url: `https://github.com${sub.replace("/repos", "").replace("/issues", "")}/issues/${issueNo}` });
    }
    return json(res, 404, {});
  }

  // iTunes reviews
  const itunes = /^\/fx\/itunes\/(\w+)\/rss\/customerreviews\/id=(\d+)\//.exec(path);
  if (itunes) {
    calls.push({ kind: "fixture", method: "itunes", payload: { id: itunes[2], country: itunes[1] } });
    const entries = [{ "im:name": { label: "App" } }].concat(
      REVIEWS.map((r) => ({
        id: { label: `${itunes[2]}-${r.id}` },
        title: { label: r.title },
        content: { label: r.content },
        author: { name: { label: r.author } },
        updated: { label: iso(1) },
        "im:rating": { label: r.rating },
      })),
    );
    return json(res, 200, { feed: { entry: entries } });
  }

  // ScrapeCreators
  if (path.startsWith("/fx/sc/")) {
    calls.push({ kind: "fixture", method: path.slice(7), payload: Object.fromEntries(url.searchParams), key: req.headers["x-api-key"] ? "set" : "missing" });
    if (path.endsWith("/post/comments")) return json(res, 200, { success: true, comments: (url.searchParams.get("url") || "").includes("/p1/") ? COMMENTS : [] });
    // the global search returns the habit posts and the noise; a subreddit search only its own subreddit
    const sub = url.searchParams.get("subreddit");
    return json(res, 200, { success: true, posts: sub ? POSTS.filter((p) => p.subreddit === sub) : POSTS });
  }

  json(res, 404, { error: "mock: not found", path });
});

server.listen(PORT, "127.0.0.1", () => console.log(`mock on :${PORT}`));
