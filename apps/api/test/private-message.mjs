// One private message on a public board (open({ private: true }) in the SDKs), against `wrangler dev --local`.
// The rule under test: the board stays public, but that one conversation is only its author's and the team's.
const API = "http://localhost:18733";
let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  private message: ${label}${!cond && extra ? "  -> " + extra : ""}`);
  if (!cond) failures++;
};
const j = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });

const app = (await fetch(`${API}/v1/apps`, { method: "POST", headers: { authorization: "Bearer test-admin", "content-type": "application/json" }, body: JSON.stringify({ name: "Ledger" }) }).then(j)).body;
const admin = (method, path, body) =>
  fetch(`${API}/v1/admin${path}`, { method, headers: { authorization: `Bearer ${app.secretKey}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(j);
const person = (device) => (method, path, body) =>
  fetch(`${API}/v1${path}`, {
    method,
    headers: { "x-youasked-key": app.publicKey, "x-youasked-anon": device, origin: "http://localhost:3000", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(j);
const maya = person(`maya-pm-${Date.now()}`);
const tom = person(`tom-pm-${Date.now()}`);

const slug = `ledger-${Date.now() % 100000}`;
await admin("PATCH", "/app", { slug, publicBoard: true });
ok((await admin("GET", "/app")).body.privateMode === false, "the app's board is public");

const idea = (await maya("POST", "/requests", { title: "Dark mode for charts", body: "" })).body.request;
const help = await maya("POST", "/requests", { title: "Apple Pay shortcut not logging", body: "It says content is required", private: true });
ok(help.status === 201 && help.body.request.private === true, "a message sent with private: true is private", JSON.stringify(help.body).slice(0, 200));
const msg = help.body.request;
ok(msg.status === "open", "and isn't held for approval");
ok(idea.private === false, "a normal request on the same board stays public");

const tomList = (await tom("GET", "/requests?sort=new&status=all")).body.requests ?? [];
ok(tomList.some((x) => x.id === idea.id), "others still see the public idea");
ok(!tomList.some((x) => x.id === msg.id), "others don't see the private message in the list");
ok((await tom("GET", `/requests/${msg.id}`)).status === 404, "or by opening it directly");
const similar = (await tom("GET", `/requests/similar?q=${encodeURIComponent("Apple Pay shortcut not logging")}`)).body.requests ?? [];
ok(!similar.some((x) => x.id === msg.id), "or as a suggestion while typing");
ok((await tom("POST", `/requests/${msg.id}/vote`, {})).status >= 400, "and can't vote on it");

const mine = (await maya("GET", "/me/requests")).body.requests ?? [];
ok(mine.some((x) => x.id === msg.id), "the author has it in their own list");
ok((await maya("GET", `/requests/${msg.id}`)).status === 200, "and can open it");
const teamList = (await admin("GET", "/requests?status=all")).body.requests ?? (await admin("GET", "/requests")).body.requests ?? [];
ok(teamList.some((x) => x.id === msg.id), "the team sees it");
const board = await fetch(`${API}/v1/public/apps/${slug}/requests?status=open`).then(j);
ok(board.status === 200 && !(board.body.requests ?? []).some((x) => x.number === msg.number), "the public board page leaves it out");
ok((await maya("POST", "/requests", { title: "Another idea", body: "", private: "yes" })).body.request?.private === false, "only private: true counts");

console.log(failures ? `\n${failures} private-message check(s) failed` : "\nAll private-message checks passed");
process.exit(failures ? 1 : 0);
