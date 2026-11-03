// /admin now points at the real dashboard; the secret-key page lives on at /admin/legacy.
export const adminMovedPage = (dashboardUrl: string) => /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>YouAsked dashboard has moved</title>
<style>
  :root { --ink:#141B2D; --paper:#F4F6FA; --cobalt:#2B4BEE; --line:#dde2ec; --muted:#5d6680; --card:#fff; }
  @media (prefers-color-scheme: dark) { :root { --ink:#F4F6FA; --paper:#0f1424; --line:#26304a; --muted:#97a0b8; --card:#161d31; } }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:16px; background:var(--paper); color:var(--ink); font:16px/1.55 system-ui, sans-serif; }
  main { max-width:420px; background:var(--card); border:1px solid var(--line); border-radius:16px; padding:28px; }
  h1 { margin:0 0 8px; font-size:22px; letter-spacing:-.02em; }
  p { margin:0 0 20px; color:var(--muted); }
  a.btn { display:inline-block; background:var(--cobalt); color:#fff; text-decoration:none; font-weight:600; padding:11px 20px; border-radius:12px; }
  small { display:block; margin-top:18px; color:var(--muted); font-size:13.5px; }
  small a { color:var(--cobalt); }
</style>
</head>
<body>
<main>
  <h1>The dashboard has a new home</h1>
  <p>Sign in with Google, GitHub or an email link to manage your apps, requests and team.</p>
  <a class="btn" href="${dashboardUrl}">Open the dashboard</a>
  <small>Still using a secret key? <a href="/admin/legacy">Open the old dashboard</a>.</small>
</main>
</body>
</html>`;
