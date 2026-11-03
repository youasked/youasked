// A single-file dashboard for testing: paste the app's secret key, then triage and ship requests.
// Everything user-written is rendered with textContent, never innerHTML.
export const adminPage = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>YouAsked dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&display=swap" rel="stylesheet">
<style>
  :root { --ink:#141B2D; --paper:#F4F6FA; --cobalt:#2B4BEE; --butter:#FFE066; --line:#dde2ec; --muted:#5d6680; --card:#fff; }
  @media (prefers-color-scheme: dark) { :root { --ink:#F4F6FA; --paper:#0f1424; --line:#26304a; --muted:#97a0b8; --card:#161d31; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font:15px/1.5 "Bricolage Grotesque", system-ui, sans-serif; }
  main { max-width: 920px; margin: 0 auto; padding: 28px 16px 80px; }
  h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: -.02em; }
  .sub { color: var(--muted); margin: 0 0 22px; }
  .key { display:flex; gap:8px; margin-bottom: 18px; flex-wrap: wrap; }
  input, select, textarea, button { font: inherit; color: inherit; }
  input, select, textarea { background: var(--card); border:1px solid var(--line); border-radius:10px; padding:8px 10px; }
  .key input { flex: 1; min-width: 240px; }
  button { background: var(--cobalt); color:#fff; border:0; border-radius:10px; padding:8px 14px; font-weight:600; cursor:pointer; }
  button.ghost { background: transparent; color: var(--ink); border:1px solid var(--line); }
  .filters { display:flex; gap:6px; margin-bottom: 14px; flex-wrap: wrap; }
  .filters button { background: transparent; color: var(--ink); border:1px solid var(--line); }
  .filters button.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .req { background: var(--card); border:1px solid var(--line); border-radius: 14px; padding: 14px 16px; margin-bottom: 10px; display:grid; grid-template-columns: 56px minmax(0,1fr); gap: 14px; }
  .votes { text-align:center; font-weight:700; font-size: 20px; line-height: 1.1; }
  .votes small { display:block; font-weight:400; font-size:12px; color: var(--muted); }
  .title { font-weight: 600; font-size: 16px; margin: 0; overflow-wrap:anywhere; }
  .body { color: var(--muted); white-space: pre-wrap; margin: 4px 0 0; overflow-wrap:anywhere; }
  .meta { font-size: 13px; color: var(--muted); margin-top: 6px; }
  .actions { display:flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; align-items: center; }
  .actions input { flex: 1; min-width: 180px; }
  .status-shipped { border-left: 4px solid #16a34a; }
  .status-in_progress { border-left: 4px solid #d97706; }
  .status-planned { border-left: 4px solid var(--cobalt); }
  .empty { color: var(--muted); padding: 30px 0; text-align:center; }
  .toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--ink); color: var(--paper); padding: 10px 16px; border-radius: 12px; font-weight:600; opacity:0; transition: opacity .2s; pointer-events:none; }
  .toast.show { opacity: 1; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--cobalt); outline-offset: 2px; }
</style>
</head>
<body>
<main>
  <h1 id="appname">YouAsked</h1>
  <p class="sub">Change a status to tell everyone who asked or voted. Shipping notifies them in your app.</p>
  <form class="key" id="keyform">
    <input id="key" type="password" placeholder="Secret key (ya_sec_…)" autocomplete="off">
    <button>Open</button>
  </form>
  <div class="filters" id="filters"></div>
  <div id="list"></div>
</main>
<div class="toast" id="toast"></div>
<script>
const STATUSES = [["open","Open"],["planned","Planned"],["in_progress","In progress"],["shipped","Shipped"],["declined","Declined"]];
const FILTERS = [["all","All"],...STATUSES];
let key = ""; try { key = localStorage.getItem("ya_admin_key") || ""; } catch {}
let filter = "all";
const $ = (id) => document.getElementById(id);
function el(tag, props, ...kids) {
  const n = document.createElement(tag);
  Object.assign(n, props || {});
  for (const k of kids) if (k != null) n.append(k);
  return n;
}
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2200); }
async function api(path, opts = {}) {
  const res = await fetch("/v1/admin" + path, { ...opts, headers: { authorization: "Bearer " + key, "content-type": "application/json" } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
  return res.json();
}
function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return m + "m ago"; const h = Math.round(m / 60); if (h < 48) return h + "h ago"; return Math.round(h / 24) + "d ago";
}
function renderFilters() {
  $("filters").replaceChildren(...FILTERS.map(([v, label]) => el("button", { textContent: label, className: v === filter ? "on" : "", onclick: () => { filter = v; renderFilters(); load(); } })));
}
async function load() {
  if (!key) return;
  try {
    const appInfo = await api("/app");
    $("appname").textContent = appInfo.name;
    const { requests } = await api("/requests?status=" + filter);
    if (!requests.length) { $("list").replaceChildren(el("p", { className: "empty", textContent: "Nothing here yet." })); return; }
    $("list").replaceChildren(...requests.map(row));
  } catch (e) { toast("Couldn't load: " + e.message); }
}
function row(r) {
  const select = el("select", {}, ...STATUSES.map(([v, l]) => el("option", { value: v, textContent: l, selected: v === r.status })));
  const note = el("input", { placeholder: "Ship note (shown to everyone who asked)", value: r.shipNote || "" });
  const reply = el("input", { placeholder: "Reply as the team" });
  const save = el("button", { textContent: "Save", onclick: async () => {
    try {
      const out = await api("/requests/" + r.id, { method: "PATCH", body: JSON.stringify({ status: select.value, shipNote: note.value }) });
      toast(out.notified ? "Shipped. Everyone who asked will see it." : "Saved");
      load();
    } catch (e) { toast("Couldn't save: " + e.message); }
  }});
  const send = el("button", { className: "ghost", textContent: "Reply", onclick: async () => {
    if (!reply.value.trim()) return;
    try { await api("/requests/" + r.id + "/comments", { method: "POST", body: JSON.stringify({ body: reply.value }) }); toast("Reply posted"); load(); }
    catch (e) { toast("Couldn't reply: " + e.message); }
  }});
  const who = r.author.anonymous ? "Anonymous" : (r.author.name || r.author.email || "User");
  return el("article", { className: "req status-" + r.status },
    el("div", { className: "votes" }, String(r.votes), el("small", { textContent: r.votes === 1 ? "vote" : "votes" })),
    el("div", {},
      el("p", { className: "title", textContent: r.title }),
      r.body ? el("p", { className: "body", textContent: r.body }) : null,
      el("div", { className: "meta", textContent: who + " · " + ago(r.createdAt) + " · " + r.comments + " comments · " + r.id }),
      el("div", { className: "actions" }, select, note, save),
      el("div", { className: "actions" }, reply, send),
    ),
  );
}
$("keyform").onsubmit = (e) => { e.preventDefault(); key = $("key").value.trim(); try { localStorage.setItem("ya_admin_key", key); } catch {} load(); };
$("key").value = key;
renderFilters();
load();
</script>
</body>
</html>`;
