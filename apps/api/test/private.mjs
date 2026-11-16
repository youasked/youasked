// Private mode end to end, against `wrangler dev --local` (port 18733). Run by test/run.sh after the scenario.
// The rule under test: in private mode a person only ever sees their own conversations.
const API = "http://localhost:18733";
let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  private: ${label}${!cond && extra ? "  -> " + extra : ""}`);
  if (!cond) failures++;
};
const j = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });

const r = await fetch(`${API}/v1/apps`, { method: "POST", headers: { authorization: "Bearer test-admin", "content-type": "application/json" }, body: JSON.stringify({ name: "Hush" }) }).then(j);
const app = r.body;
const admin = (method, path, body) =>
  fetch(`${API}/v1/admin${path}`, { method, headers: { authorization: `Bearer ${app.secretKey}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(j);
const person = (device) => (method, path, body) =>
  fetch(`${API}/v1${path}`, {
    method,
    headers: { "x-youasked-key": app.publicKey, "x-youasked-anon": device, origin: "http://localhost:3000", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(j);
const maya = person(`maya-device-${Date.now()}`);
const tom = person(`tom-device-${Date.now()}`);
const sam = person(`sam-device-${Date.now()}`);

// Before private mode: a public request anyone can see.
const before = (await sam("POST", "/requests", { title: "Calendar view", body: "" })).body.request;

let res = await admin("PATCH", "/app", { privateMode: true, slug: `hush-${Date.now() % 100000}`, publicBoard: true });
ok(res.status === 200, "owner turns private mode on");
ok((await admin("GET", "/app")).body.privateMode === true, "GET /app reports privateMode");
ok((await maya("GET", "/config")).body.private === true, "widget config says private");

const mine = (await maya("POST", "/requests", { title: "Export to Excel", body: "My accountant needs my tasks every month." })).body.request;
ok(mine?.private === true && mine.status === "open", "new request is stamped private and open", JSON.stringify(mine));

// Tom sees nothing of Maya's, by any route.
ok(!(await tom("GET", "/requests?status=all")).body.requests.some((x) => x.id === mine.id), "list hides other people's conversations");
ok(!(await tom("GET", "/requests?status=all")).body.requests.some((x) => x.id === before.id), "private mode hides older public requests from the list too");
ok((await tom("GET", `/requests/${mine.id}`)).status === 404, "someone else's conversation is a 404");
ok((await tom("POST", `/requests/${mine.id}/vote`)).status === 404, "can't vote on it");
ok((await tom("POST", `/requests/${mine.id}/comments`, { body: "me too" })).status === 404, "can't comment on it");
ok((await tom("GET", "/requests/similar?q=export%20excel")).body.requests.length === 0, "no similar suggestions in private mode");
ok((await maya("POST", `/requests/${mine.id}/vote`)).status === 400, "voting is off in private mode, even on your own");

// Maya sees hers, with the last message.
let own = await maya("GET", `/requests/${mine.id}`);
ok(own.status === 200 && own.body.request.title === "Export to Excel", "the author sees their own conversation");
let list = (await maya("GET", "/me/requests")).body.requests;
ok(list.length === 1 && list[0].last?.body.includes("accountant") && list[0].last.team === false, "me/requests lists the conversation with its last message", JSON.stringify(list[0]?.last));

// No public board, no share page.
const slug = (await admin("GET", "/app")).body.slug;
ok((await fetch(`${API}/v1/public/apps/${slug}`)).status === 404, "the public board is off in private mode");

// Tom asks for the same thing; the team links his conversation to Maya's.
const his = (await tom("POST", "/requests", { title: "Excel export please", body: "" })).body.request;
res = await admin("POST", `/requests/${his.id}/merge`, { into: mine.id });
ok(res.status === 200 && res.body.linked === true, "merging private conversations links them instead", JSON.stringify(res.body));
let detail = await admin("GET", `/requests/${mine.id}`);
ok(detail.body.linked?.conversations.length === 2 && detail.body.request.votes === 2, "the request shows both conversations and counts 2 people", JSON.stringify(detail.body.linked));
ok((await tom("GET", `/requests/${mine.id}`)).status === 404, "linking doesn't let Tom see Maya's conversation");
ok((await tom("GET", `/requests/${his.id}`)).body.request.title === "Excel export please", "Tom still sees his own conversation, in his words");

// Replying: one person, or everyone linked.
res = await admin("POST", `/requests/${his.id}/comments`, { body: "Thanks Tom, noted." });
ok(res.body.notified === 1 && res.body.conversations === 1, "a reply reaches one person", JSON.stringify(res.body));
ok(!(await maya("GET", `/requests/${mine.id}`)).body.comments.some((c) => c.body === "Thanks Tom, noted."), "Maya doesn't see the reply to Tom");
res = await admin("POST", `/requests/${his.id}/comments`, { body: "Planned for December.", everyone: true });
ok(res.body.conversations === 2 && res.body.notified === 2, "reply to everyone reaches both conversations", JSON.stringify(res.body));
ok((await maya("GET", `/requests/${mine.id}`)).body.comments.some((c) => c.team && c.body === "Planned for December."), "Maya gets the everyone reply in her thread");
const tomConfig = (await tom("GET", "/config")).body;
ok(tomConfig.unseen.length > 0 && tomConfig.unseen.every((n) => n.requestId === his.id && n.title === "Excel export please"), "Tom's notices point at his own conversation", JSON.stringify(tomConfig.unseen));
list = (await tom("GET", "/me/requests")).body.requests;
ok(list[0]?.unread === true && list[0].last.team === true, "his list shows the unread team reply");

// Status follows the linked request; changing a linked conversation changes the request.
res = await admin("PATCH", `/requests/${his.id}`, { status: "planned" });
ok((await admin("GET", `/requests/${mine.id}`)).body.request.status === "planned", "setting status on a linked conversation sets its request");
ok((await tom("GET", `/requests/${his.id}`)).body.request.status === "planned", "the linked conversation shows Planned");
res = await admin("PATCH", `/requests/${mine.id}`, { status: "shipped", shipNote: "Find it in Reports, then Export." });
ok(res.body.told === 2, "shipping tells both people", JSON.stringify(res.body));
const tomAfter = (await tom("GET", `/requests/${his.id}`)).body.request;
ok(tomAfter.status === "shipped" && tomAfter.shipNote === "Find it in Reports, then Export.", "Tom's conversation is shipped with the note");
const shipped = (await tom("GET", "/config")).body.unseen.find((n) => n.kind === "shipped");
ok(shipped?.requestId === his.id && shipped.title === "Excel export please", "Tom's shipped notice is about his own conversation", JSON.stringify(shipped));
const news = (await tom("GET", "/config")).body.whatsNew;
ok(!news || news.items.every((i) => i.id === his.id), "what's new only lists Tom's own", JSON.stringify(news));
ok((await fetch(`${API}/v1/public/apps/${slug}/shipped/${mine.number}`)).status === 404, "a shipped private request has no share page");
ok((await admin("GET", `/requests/${mine.id}`)).body.request.shareUrl === null, "and no share link in the dashboard");

// Needs a reply, done, reopened.
const needs = async (id) => (await admin("GET", "/requests?status=all")).body.requests.find((x) => x.id === id)?.needsReply;
await tom("POST", `/requests/${his.id}/comments`, { body: "Where's the CSV option?" });
ok((await needs(his.id)) === true, "Tom writing after the ship needs a reply");
await admin("POST", `/requests/${his.id}/done`, { done: true });
ok((await needs(his.id)) === false, "marking it done clears needs a reply");
await tom("POST", `/requests/${his.id}/comments`, { body: "Found it, thanks" });
ok((await needs(his.id)) === true, "writing again reopens it");

// Late joiners to something already shipped are told straight away.
const late = (await sam("POST", "/requests", { title: "Spreadsheet export", body: "" })).body.request;
await admin("POST", `/requests/${late.id}/link`, { into: his.id });
const samView = (await sam("GET", `/requests/${late.id}`)).body.request;
ok(samView.status === "shipped", "linking to a shipped request ships the conversation");
ok((await sam("GET", "/config")).body.unseen.some((n) => n.kind === "shipped" && n.requestId === late.id), "and tells the person");
ok((await admin("GET", `/requests/${late.id}`)).body.linked?.root.id === mine.id, "linking to a linked conversation files it under the request itself");

// Unlink.
await admin("POST", `/requests/${late.id}/unlink`);
ok((await admin("GET", `/requests/${mine.id}`)).body.request.votes === 2, "unlinking takes the person off the count");

// Private stays private after the app goes public again.
await admin("PATCH", "/app", { privateMode: false });
const pubList = (await sam("GET", "/requests?status=all")).body.requests;
ok(!pubList.some((x) => x.id === mine.id || x.id === his.id), "conversations written in private mode stay private");
ok(pubList.some((x) => x.id === before.id), "requests from before private mode are public again");
ok((await sam("GET", `/requests/${mine.id}`)).status === 404, "and stay a 404 for others");
const board = await fetch(`${API}/v1/public/apps/${slug}/requests?status=shipped`).then(j);
ok(board.status === 200 && !board.body.requests.some((x) => x.number === mine.number), "the public board leaves them out");

console.log(failures ? `\n${failures} private-mode check(s) failed` : "\nAll private-mode checks passed");
process.exit(failures ? 1 : 0);
