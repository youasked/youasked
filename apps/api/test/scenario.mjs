// End-to-end check against `wrangler dev --local` (port 18733) and test/mock.mjs (port 19711).
//   node apps/api/test/scenario.mjs
import { execSync } from "node:child_process";

const API = "http://localhost:18733";
const MOCK = "http://localhost:19711";
const SHARED_SECRET = "shared-webhook-secret-123456";
let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && extra ? "  -> " + extra : ""}`);
  if (!cond) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });

const admin = (key) => (method, path, body) =>
  fetch(`${API}/v1/admin${path}`, { method, headers: { authorization: `Bearer ${key}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(j);

async function newApp(name) {
  const r = await fetch(`${API}/v1/apps`, { method: "POST", headers: { authorization: "Bearer test-admin", "content-type": "application/json" }, body: JSON.stringify({ name }) }).then(j);
  return { ...r.body, api: admin(r.body.secretKey) };
}
let anonN = 0;
async function ask(app, title, body = "") {
  anonN++;
  const r = await fetch(`${API}/v1/requests`, {
    method: "POST",
    headers: { "x-youasked-key": app.publicKey, "x-youasked-anon": `anon-device-${anonN}-${Date.now()}`, "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ title, body, context: { path: "/settings", topic: "export" } }),
  }).then(j);
  if (r.status !== 201) throw new Error("ask failed " + JSON.stringify(r));
  return r.body.request;
}
const mock = () => fetch(`${MOCK}/_calls`).then((r) => r.json());
const reset = () => fetch(`${MOCK}/_reset`, { method: "POST" });
const sql = (q) => execSync(`npx wrangler d1 execute youasked --local --persist-to /tmp/ya-state --config test/wrangler.test.jsonc --command "${q.replace(/"/g, '\\"')}"`, { cwd: new URL("..", import.meta.url).pathname, stdio: "pipe" }).toString();

let msgSeq = 5000;
const post = (path, secret, update) =>
  fetch(`${API}/v1/hooks/${path}`, { method: "POST", headers: { "content-type": "application/json", ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}) }, body: JSON.stringify(update) }).then(j);
const press = (path, secret, chatId, messageId, data) =>
  post(path, secret, { callback_query: { id: `cb${++msgSeq}`, data, message: { message_id: messageId, chat: { id: chatId } } } });

const tgCalls = (calls, method) => calls.filter((c) => c.kind === "telegram" && c.method === method);
const cardFor = (calls, requestId) => calls.find((c) => c.kind === "telegram" && c.method === "sendMessage" && JSON.stringify(c.payload.reply_markup ?? {}).includes(`s:${requestId}:`));
const buttons = (card) => (card.payload.reply_markup?.inline_keyboard ?? []).flat();

/** Runs the card -> buttons -> reply -> build flow for an interactive mode. */
async function interactiveFlow(label, app, hookPath, secret, chatId, botPrefix) {
  await reset();
  const r = await ask(app, `${label}: export my data`, "I want CSV export of everything");
  await sleep(1200);
  let calls = await mock();
  const card = cardFor(calls, r.id);
  ok(Boolean(card), `${label}: new request card sent`);
  if (!card) return;
  ok(card.bot === botPrefix, `${label}: card sent with the right bot token`, card.bot);
  ok(card.payload.chat_id === String(chatId) || card.payload.chat_id === chatId, `${label}: card went to the chat`);
  const labels = buttons(card).map((b) => b.text);
  ok(labels.some((l) => l.includes("Planned")) && labels.some((l) => l.includes("Shipped")) && labels.some((l) => l.includes("Reply")) && labels.some((l) => l.includes("Build it")), `${label}: card has Planned / Shipped / Reply / Build it`, labels.join("|"));

  await reset();
  await press(hookPath, secret, chatId, card.mid, `s:${r.id}:planned`);
  let detail = await app.api("GET", `/requests/${r.id}`);
  ok(detail.body.request.status === "planned", `${label}: Planned button changed the status`, detail.body.request.status);
  calls = await mock();
  ok(tgCalls(calls, "editMessageText").length === 1 && tgCalls(calls, "answerCallbackQuery").length === 1, `${label}: card refreshed and callback answered`);
  ok(calls.every((c) => c.bot === botPrefix), `${label}: every Telegram call used the right bot`);

  await reset();
  await press(hookPath, secret, chatId, card.mid, `r:${r.id}`);
  calls = await mock();
  const prompt = tgCalls(calls, "sendMessage").find((c) => c.payload.reply_markup?.force_reply);
  ok(Boolean(prompt), `${label}: Reply button asks for the reply`);
  await post(hookPath, secret, { message: { message_id: ++msgSeq, text: "Coming this week, thanks!", chat: { id: chatId, type: "group" }, reply_to_message: { message_id: prompt.mid } } });
  detail = await app.api("GET", `/requests/${r.id}`);
  ok(detail.body.comments.some((c) => c.is_team && c.body === "Coming this week, thanks!"), `${label}: reply to the prompt became a team comment`);

  // Plain reply-to-card
  await reset();
  await post(hookPath, secret, { message: { message_id: ++msgSeq, text: "Direct reply to the card", chat: { id: chatId, type: "group" }, reply_to_message: { message_id: card.mid } } });
  detail = await app.api("GET", `/requests/${r.id}`);
  ok(detail.body.comments.some((c) => c.is_team && c.body === "Direct reply to the card"), `${label}: reply-to-card became a team comment`);

  await reset();
  await press(hookPath, secret, chatId, card.mid, `b:${r.id}`);
  calls = await mock();
  const built = tgCalls(calls, "sendMessage").find((c) => (c.payload.text ?? "").includes("closes YA-"));
  const doc = tgCalls(calls, "sendDocument");
  ok(Boolean(built) || doc.length === 1, `${label}: Build it sent the prompt (${built ? "as text" : "as file"})`);

  await reset();
  await press(hookPath, secret, chatId, card.mid, `s:${r.id}:shipped`);
  detail = await app.api("GET", `/requests/${r.id}`);
  ok(detail.body.request.status === "shipped", `${label}: Shipped button shipped it`);
  return r;
}

// ================================================================== setup
console.log("--- setup");
const shared = await newApp("Habitly");
const own = await newApp("OwnBotApp");
const notify = await newApp("NotifyApp");

// ================================================================== shared mode
console.log("--- shared bot");
const noKey = await fetch(`${API}/v1/admin/integrations/telegram/connect`, { method: "POST" }).then(j);
ok(noKey.status === 401, "connect requires the secret key");
const conn = await shared.api("POST", "/integrations/telegram/connect");
ok(conn.status === 200 && conn.body.link?.startsWith("https://t.me/youasked_bot?startgroup=") && conn.body.directLink?.startsWith("https://t.me/youasked_bot?start=") && conn.body.code, "connect returns link, directLink, code", JSON.stringify(conn.body));
const code = conn.body.code;

const badSecret = await post("telegram-shared", "wrong", { message: { message_id: 1, text: `/start ${code}`, chat: { id: -1001, type: "group" } } });
ok(badSecret.status === 403, "shared webhook rejects a wrong secret token");

await reset();
const SH_CHAT = -100777;
await post("telegram-shared", SHARED_SECRET, { message: { message_id: 1, text: `/start@youasked_bot ${code}`, chat: { id: SH_CHAT, title: "Habitly team", type: "supergroup" } } });
let calls = await mock();
const hello = tgCalls(calls, "sendMessage")[0];
ok(hello?.payload.text.includes("Connected to <b>Habitly</b>") && hello.payload.text.includes("New requests will show up here."), "/start <code> in a group replies Connected to Habitly", hello?.payload.text);
const ints = await shared.api("GET", "/integrations");
ok(ints.body.telegram?.connected && ints.body.telegram.mode === "shared" && ints.body.telegram.botUsername === "youasked_bot", "GET /integrations shows shared telegram connected", JSON.stringify(ints.body.telegram));

await reset();
await post("telegram-shared", SHARED_SECRET, { message: { message_id: 2, text: `/start ${code}`, chat: { id: -100999, type: "group" } } });
calls = await mock();
ok(tgCalls(calls, "sendMessage")[0]?.payload.text.includes("expired or was already used"), "a used code cannot be reused");

// Private-chat connect for a second app, sharing the SAME chat later is covered below.
const conn2 = await own.api("POST", "/integrations/telegram/connect"); // temporary: bind OwnBotApp via shared first to test one chat / two apps
await post("telegram-shared", SHARED_SECRET, { message: { message_id: 3, text: `/start ${conn2.body.code}`, chat: { id: SH_CHAT, title: "Habitly team", type: "supergroup" } } });
await reset();
await post("telegram-shared", SHARED_SECRET, { message: { message_id: 4, text: "/apps", chat: { id: SH_CHAT, type: "supergroup" } } });
calls = await mock();
const appsMsg = tgCalls(calls, "sendMessage")[0]?.payload.text ?? "";
ok(appsMsg.includes("Habitly") && appsMsg.includes("OwnBotApp"), "/apps lists both apps bound to the chat", appsMsg);
await reset();
await post("telegram-shared", SHARED_SECRET, { message: { message_id: 5, text: "/help", chat: { id: SH_CHAT, type: "supergroup" } } });
calls = await mock();
ok(tgCalls(calls, "sendMessage")[0]?.payload.text.includes("/apps"), "/help works");

// Two apps in one chat: a button on Habitly's card must change Habitly's request only.
await reset();
const rB = await ask(own, "Two-apps-one-chat request");
await sleep(1000);
calls = await mock();
const cardB = cardFor(calls, rB.id);
ok(Boolean(cardB) && cardB.payload.chat_id === String(SH_CHAT), "second app's card reached the same shared chat");
await press("telegram-shared", SHARED_SECRET, SH_CHAT, cardB.mid, `s:${rB.id}:planned`);
ok((await own.api("GET", `/requests/${rB.id}`)).body.request.status === "planned", "button routed to the right app in a shared chat");
// A chat that is NOT bound cannot act on the card.
await press("telegram-shared", SHARED_SECRET, -100123456, cardB.mid, `s:${rB.id}:shipped`);
ok((await own.api("GET", `/requests/${rB.id}`)).body.request.status === "planned", "an unbound chat cannot press buttons");
// Put OwnBotApp back to be a real own-bot app: connecting its own bot replaces the shared binding.

await interactiveFlow("shared", shared, "telegram-shared", SHARED_SECRET, SH_CHAT, "9000");

// ================================================================== own-bot mode
console.log("--- own bot");
await reset();
const OWN_TOKEN = "700001:OWNBOTTOKEN_OWNBOTTOKEN_OWNBOTTOKEN1";
const put = await own.api("PUT", "/integrations/telegram", { botToken: OWN_TOKEN });
ok(put.status === 200 && put.body.link, "own bot connected (PUT /integrations/telegram)", JSON.stringify(put.body));
calls = await mock();
const hookCall = tgCalls(calls, "setWebhook")[0];
const ownPath = new URL(hookCall.payload.url).pathname.replace("/v1/hooks/", "");
const ownSecret = hookCall.payload.secret_token;
const ownCode = put.body.link.split("start=")[1];
const OWN_CHAT = 4242;
await reset();
await post(ownPath, ownSecret, { message: { message_id: 1, text: `/start ${ownCode}`, chat: { id: OWN_CHAT, first_name: "Owner", type: "private" } } });
calls = await mock();
ok(tgCalls(calls, "sendMessage")[0]?.payload.text.includes("Connected to <b>OwnBotApp</b>"), "own bot /start links the chat");
await interactiveFlow("own", own, ownPath, ownSecret, OWN_CHAT, "7000");

// ================================================================== notify-only
console.log("--- notify-only");
await reset();
const N_TOKEN = "700002:NOTIFYBOTTOKEN_NOTIFYBOTTOKEN_NOTIFY";
const np = await notify.api("PUT", "/integrations/telegram", { botToken: N_TOKEN, mode: "notify", chatId: 5555 });
ok(np.status === 200 && np.body.mode === "notify", "notify-only connected");
await reset();
const rN = await ask(notify, "Notify-only request");
await sleep(1000);
calls = await mock();
const nCard = tgCalls(calls, "sendMessage").find((c) => c.payload.text.includes("Notify-only request"));
const nButtons = (nCard?.payload.reply_markup?.inline_keyboard ?? []).flat();
ok(Boolean(nCard) && nCard.bot === "7000" && nButtons.length === 1 && nButtons[0].url && !nButtons[0].callback_data, "notify-only card is unchanged: one dashboard link button, no callbacks", JSON.stringify(nButtons));
const nHook = await post("telegram/anything", null, {});
ok(nHook.status === 404, "notify-only has no webhook route");

// ================================================================== build route
console.log("--- build it");
const b1 = await shared.api("POST", `/requests/${(await shared.api("GET", "/requests?status=all")).body.requests[0].id}/build`);
ok(b1.status === 200 && b1.body.prompt.includes("closes YA-") && b1.body.prompt.includes("Acceptance criteria") && !b1.body.issueUrl, "build without a GitHub token: prompt, no issueUrl", JSON.stringify(Object.keys(b1.body)));
console.log("      refined by AI:", b1.body.refined, "| prompt length", b1.body.prompt.length);
const target = (await shared.api("GET", "/requests?status=all")).body.requests[0];
const badTok = await shared.api("PUT", "/integrations/github-token", { token: "ghp_nope", repo: "acme/widgets" });
ok(badTok.status === 400 && badTok.body.error === "token_rejected", "bad GitHub token is rejected", JSON.stringify(badTok.body));
const badRepo = await shared.api("PUT", "/integrations/github-token", { token: "ghp_goodtoken", repo: "acme/missing" });
ok(badRepo.status === 400 && badRepo.body.error === "repo_not_found", "unknown repo is rejected", JSON.stringify(badRepo.body));
const goodTok = await shared.api("PUT", "/integrations/github-token", { token: "ghp_goodtoken", repo: "https://github.com/acme/widgets" });
ok(goodTok.status === 200 && goodTok.body.repo === "acme/widgets" && !JSON.stringify(goodTok.body).includes("goodtoken"), "token accepted; response does not contain it", JSON.stringify(goodTok.body));
const stored = sql("SELECT config FROM integrations WHERE kind = 'github' AND app_id = '" + shared.id + "'");
ok(!stored.includes("ghp_goodtoken") && stored.includes("tokenEnc"), "token is stored encrypted, not in plain text");
const gi = await shared.api("GET", "/integrations");
ok(gi.body.github?.tokenConnected === true && !JSON.stringify(gi.body).includes("goodtoken"), "GET /integrations never returns the token", JSON.stringify(gi.body.github));
await reset();
const b2 = await shared.api("POST", `/requests/${target.id}/build`);
ok(b2.status === 200 && b2.body.issueUrl?.includes("github.com/acme/widgets/issues/"), "build with a token opens an issue and returns issueUrl", JSON.stringify(b2.body.issueUrl));
const b3 = await shared.api("POST", `/requests/${target.id}/build`);
calls = await mock();
ok(b3.body.issueUrl === b2.body.issueUrl && calls.filter((c) => c.kind === "github").length === 1, "second build reuses the issue (idempotent)");
const gcall = calls.find((c) => c.kind === "github");
ok(gcall?.payload.labels?.includes("youasked") && gcall.payload.title.startsWith("YA-"), "issue has the youasked label and a YA- title", JSON.stringify(gcall?.payload));
await reset();
const rb = await ask(shared, "Build button with issue", "details here");
await sleep(1000);
calls = await mock();
const card3 = cardFor(calls, rb.id);
await reset();
await press("telegram-shared", SHARED_SECRET, SH_CHAT, card3.mid, `b:${rb.id}`);
calls = await mock();
const sent = tgCalls(calls, "sendMessage").find((c) => (c.payload.text ?? "").includes("GitHub issue: "));
ok(Boolean(sent) && calls.filter((c) => c.kind === "github").length === 1, "Build it button replies with the prompt and the issue link");
// A long prompt goes out as a file.
await reset();
const longReq = await ask(shared, "Long request", Array.from({ length: 60 }, (_, i) => `Point ${i + 1}: the export should keep categories, notes and the original currency.`).join(" "));
for (let i = 0; i < 12; i++) await shared.api("POST", `/requests/${longReq.id}/comments`, { body: "team: " + "y".repeat(300) });
const fatId = (await shared.api("GET", "/requests?status=all")).body.requests.find((r) => r.title === "Long request").id;
await sleep(800);
calls = await mock();
const longCard = cardFor(calls, longReq.id);
await reset();
await press("telegram-shared", SHARED_SECRET, SH_CHAT, longCard.mid, `b:${fatId}`);
calls = await mock();
ok(tgCalls(calls, "sendDocument").length === 1, "a long prompt is sent as a file", tgCalls(calls, "sendMessage").map((c) => c.payload.text?.length).join(","));

// ================================================================== listening
console.log("--- heard elsewhere");
const g0 = await shared.api("GET", "/listening/config");
ok(g0.status === 402 && g0.body.upgrade === true, "listening is 402 {upgrade:true} without a plan", JSON.stringify(g0.body));
sql("INSERT INTO workspaces (id, name, plan, subscription_status, created_at) VALUES ('ws_t1', 'T', 'pro', 'active', 1)");
sql("INSERT INTO workspaces (id, name, plan, subscription_status, created_at) VALUES ('ws_solo', 'S', 'solo', 'active', 1)");
sql(`UPDATE apps SET workspace_id = 'ws_t1' WHERE id IN ('${shared.id}', '${own.id}')`);
sql(`UPDATE apps SET workspace_id = 'ws_solo' WHERE id = '${notify.id}'`);
const solo = await notify.api("PUT", "/listening/config", { keywords: ["x"] });
ok(solo.status === 402 && solo.body.upgrade, "Solo plan (listeningApps 0) gets 402");
const cfgPut = await shared.api("PUT", "/listening/config", {
  keywords: ["habit tracker", "streak"],
  competitors: [{ name: "Streaks", appStoreId: "111111111" }],
  subreddits: ["productivity"],
  about: "A habit tracker app with streaks and reminders",
  appStoreId: "222222222",
});
ok(cfgPut.status === 200 && cfgPut.body.competitors.length === 1, "PUT /listening/config saved (Pro, 1 slot)", JSON.stringify(cfgPut.body));
const second = await own.api("PUT", "/listening/config", { keywords: ["a"] });
ok(second.status === 402 && second.body.upgrade, "a second app in a 1-slot workspace gets 402", JSON.stringify(second.body));
const cfgGet = await shared.api("GET", "/listening/config");
ok(cfgGet.body.keywords[0] === "habit tracker" && cfgGet.body.subreddits[0] === "productivity", "GET /listening/config returns it");

// Existing request the offline ask should match.
await ask(shared, "Offline mode", "work without internet");
await reset();
const run = await shared.api("POST", "/listening/run");
ok(run.status === 200 && run.body.inbox >= 3, "manual run found items", JSON.stringify(run.body));
calls = await mock();
const fx = calls.filter((c) => c.kind === "fixture");
const scCalls = fx.filter((c) => c.method !== "itunes");
ok(scCalls.length <= 14 && scCalls.some((c) => c.method.endsWith("post/comments")) && scCalls.every((c) => c.key === "set"), `reddit calls capped (${scCalls.length}) incl. comments, key sent`);
ok(fx.some((c) => c.method === "itunes" && c.payload.id === "111111111") && fx.some((c) => c.method === "itunes" && c.payload.id === "222222222"), "App Store RSS fetched for competitor and own app");
const inbox = await shared.api("GET", "/listening/inbox");
const items = inbox.body.items;
console.log("      inbox:", items.map((i) => `${i.source}/${i.strength}/${i.feature}${i.matchedRequest ? " ~" + i.matchedRequest.ref : ""}`).join(" | "));
ok(!items.some((i) => /brokerage|radar|Weather/i.test(i.text)), "off-topic posts (weather, brokerage) were dropped");
ok(items.some((i) => i.source === "reddit" && i.feature === "Offline mode" && i.matchedRequest?.title === "Offline mode"), "offline ask matched the existing request");
ok(items.some((i) => i.source === "appstore" && i.feature === "Home screen widget"), "App Store review with a feature ask is in the inbox");
ok(items.some((i) => i.source === "reddit" && i.feature === "Export streaks to CSV"), "comment from a busy thread is in the inbox");
ok(new Set(items.map((i) => i.url)).size === items.length, "no duplicate URLs");

// dedupe: run again via the cron
sql(`UPDATE listening_config SET last_run_at = NULL WHERE app_id = '${shared.id}'`);
const before = items.length;
await reset();
const cron = await fetch(`${API}/cdn-cgi/handler/scheduled?cron=${encodeURIComponent("30 2 * * *")}`);
await sleep(2500);
calls = await mock();
ok(cron.status === 200 && calls.some((c) => c.kind === "fixture"), "daily cron trigger ran the listening scan", String(cron.status));
const after = (await shared.api("GET", "/listening/inbox")).body.items.length;
ok(after === before, "second run adds nothing new (dedupe by URL)", `${before} -> ${after}`);

const widget = items.find((i) => i.feature === "Home screen widget");
const csv = items.find((i) => i.feature === "Export streaks to CSV");
const off = items.find((i) => i.matchedRequest);
const approved = await shared.api("POST", `/listening/inbox/${widget.id}/approve`);
ok(approved.status === 201 && approved.body.request.source === "appstore" && approved.body.request.sourceUrl === widget.url, "approve creates a request with source + source_url", JSON.stringify(approved.body));
const reqDetail = await shared.api("GET", `/requests/${approved.body.request.id}`);
ok(reqDetail.body.request.source === "appstore" && reqDetail.body.request.sourceUrl, "admin request detail includes source and sourceUrl");
const pub = await fetch(`${API}/v1/requests/${approved.body.request.id}`, { headers: { "x-youasked-key": shared.publicKey, "x-youasked-anon": "reader-device-0001", origin: "http://localhost:3000" } }).then(j);
ok(pub.body.request.source === "appstore" && pub.body.request.sourceUrl === widget.url, "public widget detail includes source and sourceUrl");
const merged = await shared.api("POST", `/listening/inbox/${off.id}/merge`, { requestId: off.matchedRequest.id });
ok(merged.status === 200, "merge into the matched request");
const mDetail = await shared.api("GET", `/requests/${off.matchedRequest.id}`);
ok(mDetail.body.request.elsewhere === 1 && mDetail.body.comments.some((c) => c.body.includes(off.url)), "merge bumps the elsewhere count and adds a comment with the link");
const dis = await shared.api("POST", `/listening/inbox/${csv.id}/dismiss`);
ok(dis.status === 200, "dismiss");
const re = await shared.api("POST", `/listening/inbox/${csv.id}/dismiss`);
ok(re.status === 409, "a handled item cannot be handled twice");
sql(`UPDATE listening_config SET last_run_at = NULL WHERE app_id = '${shared.id}'`);
await shared.api("POST", "/listening/run");
const inbox2 = (await shared.api("GET", "/listening/inbox")).body.items;
ok(!inbox2.some((i) => i.id === csv.id) && !inbox2.some((i) => i.id === widget.id), "dismissed / approved items do not come back");

// ================================================================== digest
console.log("--- digest");
await reset();
await fetch(`${API}/cdn-cgi/handler/scheduled?cron=${encodeURIComponent("0 1 * * 1")}`);
await sleep(2500);
calls = await mock();
const digests = tgCalls(calls, "sendMessage").map((c) => c.payload.text).filter((t) => t?.includes("your week"));
console.log("      digest sample:\n" + (digests.find((t) => t.includes("Habitly")) ?? "").split("\n").map((l) => "        " + l).join("\n"));
const hd = digests.find((t) => t.includes("Habitly")) ?? "";
ok(hd.includes("Most asks this week") && hd.includes("Most wanted"), "digest has the AI summary and Most wanted");
ok(digests.length >= 2, `digests reached shared-bot and own-bot chats (${digests.length})`);
ok(calls.filter((c) => c.method === "sendMessage" && c.payload.text?.includes("NotifyApp: your week")).every((c) => c.bot === "7000"), "notify-only digest still uses its own bot");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
