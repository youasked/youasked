// Moving requests in from Canny, Featurebase or any CSV, and out as CSV or JSON.
//
// Formats supported (from the vendors' own docs and migration guides):
// - Canny posts CSV (Export data): Title, Details ("Post Detail"), Votes, Comments (a count), Status, Board,
//   Created, plus author name and email when present. Canny's API/JSON export is also accepted:
//   {title, details, score, status, created, author: {name, email}}.
// - Featurebase posts CSV (Settings > Imports & exports): Post Title, Post Content, Upvote Count, Creation Date,
//   Author Name, Author's Email, Tags, Board Name, Status.
// - Generic CSV: title, body, status, votes, created_at, with forgiving header matching.
// Neither tool exports individual voters, so votes arrive as a plain number (requests.imported_votes).
import { cleanText, newId } from "./lib";
import { upsertRequests } from "./semantic";
import type { Env, RequestRow, Status } from "./types";

const MAX_ROWS = 2000;

/** RFC 4180 CSV with quoted newlines; the delimiter (comma, semicolon or tab) is sniffed from the header. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export type Incoming = {
  title: string;
  body: string;
  status: Status;
  votes: number;
  createdAt: number;
  email: string | null;
  name: string | null;
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

const ALIASES: Record<keyof Incoming, string[]> = {
  title: ["title", "posttitle", "requesttitle", "subject", "summary", "idea", "feature", "featurerequest", "name"],
  body: ["body", "details", "detail", "postdetail", "postdetails", "postcontent", "content", "description", "text", "message"],
  status: ["status", "poststatus", "state"],
  votes: ["votes", "votecount", "upvotecount", "upvotes", "numberofvotes", "score", "likes", "voters"],
  createdAt: ["createdat", "created", "creationdate", "createdon", "datecreated", "date", "posted", "postedat"],
  email: ["authoremail", "authorsemail", "useremail", "email", "submitteremail", "creatoremail"],
  name: ["authorname", "authorsname", "author", "username", "submittername", "creatorname"],
};

/** Words in other tools' status names, mapped onto ours. */
export function mapStatus(raw: string): Status {
  const s = raw.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "open";
  if (/\b(complete|completed|done|shipped|released|live|launched|delivered|finished|resolved)\b/.test(s)) return "shipped";
  if (/\b(in progress|progress|started|building|developing|in development|doing|working)\b/.test(s)) return "in_progress";
  if (/\b(planned|roadmap|approved|accepted|scheduled|next|upcoming|backlog)\b/.test(s)) return "planned";
  if (/\b(declined|rejected|closed|wont|won t|wontfix|cancel|cancelled|canceled|not planned|duplicate)\b/.test(s)) return "declined";
  return "open"; // open, new, under review, needs feedback...
}

function toTime(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v < 1e11 ? v * 1000 : v;
  if (typeof v === "string" && v.trim()) {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
    if (/^\d{9,13}$/.test(v.trim())) return toTime(Number(v));
  }
  return Date.now();
}

function toVotes(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(n, 1_000_000)) : 0;
}

function build(get: (k: keyof Incoming) => unknown): Incoming | null {
  const title = cleanText(get("title"), 120);
  if (title.length < 3) return null;
  const email = cleanText(get("email"), 320).toLowerCase();
  return {
    title,
    body: cleanText(get("body"), 4000),
    status: mapStatus(String(get("status") ?? "")),
    votes: toVotes(get("votes")),
    createdAt: toTime(get("createdAt")),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    name: cleanText(get("name"), 120) || null,
  };
}

export function parseIncoming(source: "canny" | "featurebase" | "csv", content: string): Incoming[] | { error: string } {
  const trimmed = content.trim();
  if (!trimmed) return { error: "empty_file" };
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    if (source !== "canny") return { error: "expected_csv" };
    try {
      const data = JSON.parse(trimmed) as unknown;
      const list = Array.isArray(data) ? data : ((data as { posts?: unknown[] }).posts ?? []);
      return (list as Record<string, unknown>[])
        .map((p) => {
          const author = (p.author ?? p.user ?? {}) as Record<string, unknown>;
          return build((k) => {
            switch (k) {
              case "title": return p.title;
              case "body": return p.details ?? p.description ?? p.body;
              case "status": return typeof p.status === "object" ? (p.status as { name?: string })?.name : p.status;
              case "votes": return p.score ?? p.votes ?? p.voteCount;
              case "createdAt": return p.created ?? p.createdAt;
              case "email": return author.email;
              case "name": return author.name;
            }
          });
        })
        .filter((x): x is Incoming => x !== null);
    } catch {
      return { error: "bad_json" };
    }
  }
  const rows = parseCsv(content);
  if (rows.length < 2) return { error: "no_rows" };
  const headers = rows[0].map(norm);
  const column = (k: keyof Incoming) => {
    for (const alias of ALIASES[k]) {
      const i = headers.indexOf(alias);
      if (i >= 0) return i;
    }
    return -1;
  };
  const cols = Object.fromEntries((Object.keys(ALIASES) as (keyof Incoming)[]).map((k) => [k, column(k)])) as Record<keyof Incoming, number>;
  if (cols.title < 0) return { error: "no_title_column" };
  return rows
    .slice(1)
    .map((row) => build((k) => (cols[k] >= 0 ? row[cols[k]] : undefined)))
    .filter((x): x is Incoming => x !== null);
}

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function importRequests(
  env: Env,
  appId: string,
  source: "canny" | "featurebase" | "csv",
  content: string,
): Promise<{ imported: number; skipped: number } | { error: string }> {
  const parsed = parseIncoming(source, content);
  if ("error" in parsed) return parsed;
  if (parsed.length > MAX_ROWS) return { error: "too_many_rows" };
  const db = env.DB;
  const { results: existing } = await db.prepare("SELECT title FROM requests WHERE app_id = ?").bind(appId).all<{ title: string }>();
  const seen = new Set(existing.map((r) => slug(r.title)));
  let skipped = 0;
  const fresh: Incoming[] = [];
  for (const row of parsed.sort((a, b) => a.createdAt - b.createdAt)) {
    const key = slug(row.title);
    if (!key || seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    fresh.push(row);
  }
  if (!fresh.length) return { imported: 0, skipped };

  // Authors become people without a sign-in (anonymous: they are never emailed), one per email.
  const t = Date.now();
  const externalOf = (r: Incoming) => (r.email ? `i:${r.email}` : "i:imported");
  const authors = new Map<string, Incoming>();
  for (const r of fresh) if (!authors.has(externalOf(r))) authors.set(externalOf(r), r);
  const authorList = [...authors.entries()];
  for (let i = 0; i < authorList.length; i += 50) {
    await db.batch(
      authorList.slice(i, i + 50).map(([ext, r]) =>
        db
          .prepare(
            "INSERT INTO users (id, app_id, external_id, email, name, is_anon, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT (app_id, external_id) DO NOTHING",
          )
          .bind(newId("usr"), appId, ext, r.email, r.email ? r.name : null, t, t),
      ),
    );
  }
  const authorIds = new Map<string, string>();
  for (let i = 0; i < authorList.length; i += 50) {
    const chunk = authorList.slice(i, i + 50).map(([ext]) => ext);
    const { results } = await db
      .prepare(`SELECT id, external_id FROM users WHERE app_id = ? AND external_id IN (${chunk.map(() => "?").join(",")})`)
      .bind(appId, ...chunk)
      .all<{ id: string; external_id: string }>();
    for (const u of results) authorIds.set(u.external_id, u.id);
  }

  const ids: string[] = [];
  for (let i = 0; i < fresh.length; i += 40) {
    await db.batch(
      fresh.slice(i, i + 40).map((r) => {
        const id = newId("req");
        ids.push(id);
        return db
          .prepare(
            `INSERT INTO requests (id, app_id, author_id, number, title, body, status, vote_count, imported_votes, shipped_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, (SELECT COALESCE(MAX(number), 0) + 1 FROM requests WHERE app_id = ?2), ?4, ?5, ?6, ?7, ?7, ?8, ?9, ?9)`,
          )
          .bind(id, appId, authorIds.get(externalOf(r)), r.title, r.body, r.status, r.votes, r.status === "shipped" ? r.createdAt : null, r.createdAt);
      }),
    );
  }
  // Embed in the background so duplicates of imported requests are caught too.
  const { results: rows } = await db
    .prepare(`SELECT * FROM requests WHERE id IN (${ids.slice(0, 500).map(() => "?").join(",")})`)
    .bind(...ids.slice(0, 500))
    .all<RequestRow>();
  await upsertRequests(env, rows);
  return { imported: fresh.length, skipped };
}

// ---------------------------------------------------------------- export

const FIELDS = ["ref", "title", "body", "status", "votes", "comments", "author_email", "author_name", "created_at", "updated_at", "shipped_at", "ship_note"] as const;

/** Cells that start with = + - @ are prefixed so a spreadsheet never runs them as formulas. */
function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const iso = (t: number | null) => (t ? new Date(t).toISOString() : null);

export async function exportRequests(db: D1Database, appId: string, format: "csv" | "json"): Promise<{ body: string; type: string }> {
  const { results } = await db
    .prepare(
      `SELECT r.*, u.email AS author_email, u.name AS author_name,
              (SELECT COUNT(*) FROM comments c WHERE c.request_id = r.id) AS comments_n
       FROM requests r LEFT JOIN users u ON u.id = r.author_id
       WHERE r.app_id = ? ORDER BY r.number`,
    )
    .bind(appId)
    .all<RequestRow & { author_email: string | null; author_name: string | null; comments_n: number }>();
  const rows = results.map((r) => ({
    ref: `YA-${r.number}`,
    title: r.title,
    body: r.body,
    status: r.status,
    votes: r.vote_count,
    comments: r.comments_n,
    author_email: r.author_email,
    author_name: r.author_name,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
    shipped_at: iso(r.shipped_at),
    ship_note: r.ship_note,
  }));
  if (format === "json") return { body: JSON.stringify({ requests: rows }, null, 2), type: "application/json" };
  const lines = [FIELDS.join(","), ...rows.map((row) => FIELDS.map((f) => csvCell(row[f])).join(","))];
  return { body: lines.join("\r\n") + "\r\n", type: "text/csv; charset=utf-8" };
}
