// Builds the SQL for a demo account with one demo app full of fictional requests. Used for the
// Claude Connectors Directory reviewer (see docs/claude-directory-listing.md) and by the local
// end-to-end test. It only PRINTS SQL; it never touches a database by itself.
//
//   node apps/api/scripts/seed-demo.mjs --email reviewer@example.com > /tmp/seed.sql
//   wrangler d1 execute youasked --remote --file /tmp/seed.sql      # Aden runs this by hand
//
// The account is matched by email, so the first sign-in (Google, GitHub or an email link) with
// that address lands on it. Rerunning is safe: it replaces the demo rows with fresh ones.
// Demo users have no email addresses, so replying or shipping never sends real mail.
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const q = (s) => (s === null || s === undefined ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const rid = (prefix, n = 16) => `${prefix}_${randomBytes(n).toString("hex").slice(0, n)}`;
const DAY = 86_400_000;

export function buildSeedSql({ email, appName = "Orbit Habits (demo)", workspaceName = "Demo workspace", session = null, now = Date.now() }) {
  const e = email.trim().toLowerCase();
  // Stable ids from the email, so a rerun replaces instead of piling up.
  const tag = Buffer.from(e).toString("hex").slice(0, 12);
  const acc = `acc_demo${tag}`;
  const ws = `ws_demo${tag}`;
  const app = `app_demo${tag}`;
  const sql = [];
  const run = (s) => sql.push(s + ";");

  // Clear any earlier demo rows for this account.
  run(`DELETE FROM comments WHERE request_id IN (SELECT id FROM requests WHERE app_id = ${q(app)})`);
  run(`DELETE FROM votes WHERE request_id IN (SELECT id FROM requests WHERE app_id = ${q(app)})`);
  run(`DELETE FROM notifications WHERE request_id IN (SELECT id FROM requests WHERE app_id = ${q(app)})`);
  run(`DELETE FROM requests WHERE app_id = ${q(app)}`);
  run(`DELETE FROM users WHERE app_id = ${q(app)}`);
  run(`DELETE FROM apps WHERE id = ${q(app)}`);
  run(`DELETE FROM members WHERE workspace_id = ${q(ws)}`);
  run(`DELETE FROM workspaces WHERE id = ${q(ws)}`);

  run(`INSERT INTO accounts (id, email, name, created_at) VALUES (${q(acc)}, ${q(e)}, 'Connector reviewer', ${now}) ON CONFLICT (email) DO NOTHING`);
  run(`INSERT INTO workspaces (id, name, created_at) VALUES (${q(ws)}, ${q(workspaceName)}, ${now})`);
  run(`INSERT INTO members (workspace_id, account_id, role, created_at) VALUES (${q(ws)}, (SELECT id FROM accounts WHERE email = ${q(e)}), 'owner', ${now})`);
  run(
    `INSERT INTO apps (id, name, public_key, secret_key, workspace_id, always_live, created_at) VALUES (${q(app)}, ${q(appName)}, ${q(rid("ya_pub", 24))}, ${q(rid("ya_sec", 32))}, ${q(ws)}, 1, ${now})`,
  );

  const people = ["Maya", "Jonas", "Priya", "Tom", "Aiko", "Luis", "Nora", "Sam"];
  const uid = (i) => `usr_demo${tag}${i}`;
  people.forEach((n, i) => {
    run(
      `INSERT INTO users (id, app_id, external_id, email, name, is_anon, created_at, last_seen_at) VALUES (${q(uid(i))}, ${q(app)}, ${q(`demo-${i}`)}, NULL, ${q(n)}, 0, ${now - 30 * DAY}, ${now - DAY})`,
    );
  });

  // [title, body, status, author, voters, ageDays, shipNote, comments[[who|null=team, text]]]
  const reqs = [
    ["Add a dark mode", "I use the app at night and the white screen is too bright. A dark theme would be great.", "open", 0, [0, 1, 2, 3, 4], 12, null, [[1, "Same here, my eyes would thank you."]]],
    ["Dark theme please", "Can we get a dark theme? Following the phone's setting would be perfect.", "open", 5, [5, 6], 9, null, []],
    ["Export my streaks to CSV", "I want to keep my history in a spreadsheet. A CSV export in settings would do it.", "planned", 2, [2, 1, 7, 4], 20, null, [[null, "Planned for next month. Thanks for the clear ask."]]],
    ["Home screen widget showing today's habits", "A small widget with today's checklist so I don't have to open the app.", "open", 3, [3, 0, 6], 6, null, []],
    ["Work offline and sync later", "On the train I lose signal and check-ins fail. Let me check in offline.", "in_progress", 4, [4, 2, 5, 7, 1, 0], 25, null, [[4, "This is my number one wish."], [null, "We are building this now."]]],
    ["Remind me at a time I choose", "Reminders are always at 9am. I need 7pm.", "shipped", 1, [1, 3], 40, "Find it in Settings, then Reminders.", []],
    ["Add a coffee habit emoji", "Small thing: a coffee cup in the emoji list.", "declined", 6, [6], 15, null, []],
  ];
  reqs.forEach(([title, body, status, author, voters, age, note, comments], i) => {
    const id = `req_demo${tag}${i}`;
    const created = now - age * DAY;
    run(
      `INSERT INTO requests (id, app_id, author_id, number, title, body, status, vote_count, comment_count, ship_note, shipped_at, created_at, updated_at) VALUES (` +
        [q(id), q(app), q(uid(author)), i + 1, q(title), q(body), q(status), voters.length, comments.length, q(note), status === "shipped" ? now - 10 * DAY : "NULL", created, created].join(", ") +
        `)`,
    );
    voters.forEach((v) => run(`INSERT INTO votes (request_id, user_id, created_at) VALUES (${q(id)}, ${q(uid(v))}, ${created + 1000})`));
    comments.forEach(([who, text], j) =>
      run(
        `INSERT INTO comments (id, request_id, user_id, is_team, body, created_at) VALUES (${q(`cmt_demo${tag}${i}${j}`)}, ${q(id)}, ${who === null ? "NULL" : q(uid(who))}, ${who === null ? 1 : 0}, ${q(text)}, ${created + 3600_000 * (j + 1)})`,
      ),
    );
  });

  // Local tests only: a ready-made dashboard session for the account (token hash is computed by the caller).
  if (session) run(`INSERT INTO sessions (id, account_id, created_at, expires_at) VALUES (${q(session)}, (SELECT id FROM accounts WHERE email = ${q(e)}), ${now}, ${now + DAY})`);
  return { sql: sql.join("\n") + "\n", appId: app, accountId: acc };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (n) => {
    const i = process.argv.indexOf(`--${n}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const email = arg("email");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("usage: node seed-demo.mjs --email <address the reviewer signs in with> [--app-name <name>]");
    process.exit(1);
  }
  process.stdout.write(buildSeedSql({ email, appName: arg("app-name") }).sql);
}
