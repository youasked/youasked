// Things the team does to a request. The dashboard, Telegram and GitHub all go through here,
// so everyone who asked hears about it the same way whichever one was used.
import { newId } from "./lib";
import { emitReply, emitShipped } from "./events";
import { emailReply, emailShipped, type Mail } from "./mail";
import type { RequestRow, Status } from "./types";

export const ref = (r: Pick<RequestRow, "number">) => `YA-${r.number}`;

/**
 * The latest message in a conversation, for inbox rows. Needs `r` as the requests alias. A request
 * with no comments yet counts its own text as the last (and only) message, from the person.
 */
export const LAST_MESSAGE_SQL = `(SELECT body FROM comments WHERE request_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_body,
       (SELECT is_team FROM comments WHERE request_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_team,
       (SELECT MAX(created_at) FROM comments WHERE request_id = r.id) AS last_at,
       (SELECT COUNT(*) FROM requests l WHERE l.linked_to = r.id) AS linked_count`;

export type LastMessageCols = { last_body: string | null; last_team: number | null; last_at: number | null; linked_count: number };

export function lastMessage(r: RequestRow & Partial<LastMessageCols>): { body: string; team: boolean; at: number } {
  if (r.last_at) return { body: r.last_body ?? "", team: Boolean(r.last_team), at: r.last_at };
  return { body: r.body || r.title, team: false, at: r.created_at };
}

/**
 * The person is waiting on the team: they wrote last, and the team hasn't marked it done. Once a
 * request is shipped or declined, only a new message from them after that counts.
 */
export function needsReply(r: RequestRow & Partial<LastMessageCols>): boolean {
  if (r.closed_at || r.status === "merged" || r.last_team) return false;
  if (r.status === "shipped") return Boolean(r.last_at && r.shipped_at && r.last_at > r.shipped_at);
  if (r.status === "declined") return Boolean(r.last_at);
  return true;
}

export async function loadRequestById(db: D1Database, appId: string, id: string): Promise<RequestRow | null> {
  return db.prepare("SELECT * FROM requests WHERE id = ? AND app_id = ?").bind(id, appId).first<RequestRow>();
}

export async function loadRequestByNumber(db: D1Database, appId: string, n: number): Promise<RequestRow | null> {
  return db.prepare("SELECT * FROM requests WHERE app_id = ? AND number = ?").bind(appId, n).first<RequestRow>();
}

/**
 * The request a private conversation is filed under, or the request itself. Status always lives on
 * this one; every conversation linked to it follows along.
 */
export async function rootOf(db: D1Database, r: RequestRow): Promise<RequestRow> {
  if (!r.linked_to) return r;
  return (await loadRequestById(db, r.app_id, r.linked_to)) ?? r;
}

/** People asking: direct votes, votes carried over from an import, and private conversations linked here. */
export const recount = (db: D1Database, id: string, t: number) =>
  db
    .prepare(
      `UPDATE requests SET vote_count = COALESCE(imported_votes, 0) + (SELECT COUNT(*) FROM votes WHERE request_id = ?1)
         + (SELECT COUNT(*) FROM requests l WHERE l.linked_to = ?1), updated_at = ?2 WHERE id = ?1`,
    )
    .bind(id, t);

/** "Shipped" notices for everyone in conversations linked to this request who hasn't had one. */
const noticeLinked = (db: D1Database, rootId: string, t: number) =>
  db
    .prepare(
      `INSERT INTO notifications (id, user_id, request_id, kind, created_at)
       SELECT 'ntf_' || lower(hex(randomblob(8))), l.author_id, l.id, 'shipped', ?2 FROM requests l
       WHERE l.linked_to = ?1
         AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.request_id = l.id AND n.kind = 'shipped' AND n.user_id = l.author_id)`,
    )
    .bind(rootId, t);

/** Emails each linked conversation's author about their own conversation (each once, see email_log). */
async function emailLinkedShipped(mail: Mail, rootId: string) {
  const { results } = await mail.env.DB.prepare("SELECT * FROM requests WHERE linked_to = ? AND status = 'shipped'").bind(rootId).all<RequestRow>();
  for (const l of results) await emailShipped(mail.env, l);
}

/**
 * Sets the status. Moving to shipped tells everyone who asked or voted, once per request. A linked
 * conversation changes its request instead, and every conversation linked to that request follows,
 * so each person sees the new status (and the ship note) in their own thread.
 */
export async function setStatus(
  db: D1Database,
  given: RequestRow,
  status: Status,
  shipNote?: string | null,
  mail?: Mail,
): Promise<{ notified: number; root: RequestRow; linked: number }> {
  const r = await rootOf(db, given);
  const t = Date.now();
  const becameShipped = status === "shipped" && r.status !== "shipped";
  const note = shipNote === undefined ? r.ship_note : shipNote;
  const shippedAt = status === "shipped" ? (r.shipped_at ?? t) : null;
  const stmts = [
    db.prepare("UPDATE requests SET status = ?, ship_note = ?, shipped_at = ?, updated_at = ? WHERE id = ?").bind(status, note, shippedAt, t, r.id),
    db.prepare("UPDATE requests SET status = ?, ship_note = ?, shipped_at = ?, updated_at = ? WHERE linked_to = ?").bind(status, note, shippedAt, t, r.id),
  ];
  if (becameShipped) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO notifications (id, user_id, request_id, kind, created_at)
           SELECT 'ntf_' || lower(hex(randomblob(8))), who.uid, ?1, 'shipped', ?2
           FROM (SELECT author_id AS uid FROM requests WHERE id = ?1
                 UNION SELECT user_id FROM votes WHERE request_id = ?1) who
           WHERE NOT EXISTS (SELECT 1 FROM notifications n WHERE n.request_id = ?1 AND n.kind = 'shipped' AND n.user_id = who.uid)`,
        )
        .bind(r.id, t),
      noticeLinked(db, r.id, t),
    );
  }
  const results = await db.batch(stmts);
  const linked = results[1]?.meta.changes ?? 0;
  if (becameShipped && mail) {
    mail.waitUntil(
      (async () => {
        await emailShipped(mail.env, { ...r, status, ship_note: note, shipped_at: shippedAt });
        await emailLinkedShipped(mail, r.id);
      })(),
    );
    mail.waitUntil(emitShipped(mail, { ...r, status, ship_note: note, shipped_at: shippedAt }));
  }
  const notified = becameShipped ? (results[2]?.meta.changes ?? 0) + (results[3]?.meta.changes ?? 0) : 0;
  return { notified, root: { ...r, status, ship_note: note, shipped_at: shippedAt }, linked };
}

/** Takes a shipped request back to its previous status and withdraws notices nobody has seen yet. */
export async function undoShip(db: D1Database, given: RequestRow, previous: Status) {
  const r = await rootOf(db, given);
  const t = Date.now();
  await db.batch([
    db.prepare("UPDATE requests SET status = ?, shipped_at = NULL, updated_at = ? WHERE id = ?1 OR linked_to = ?1".replace("?1 OR", "?3 OR").replace("= ?1", "= ?3")).bind(previous, t, r.id),
    db
      .prepare(
        "DELETE FROM notifications WHERE kind = 'shipped' AND seen_at IS NULL AND (request_id = ?1 OR request_id IN (SELECT id FROM requests WHERE linked_to = ?1))",
      )
      .bind(r.id),
  ]);
}

export async function setShipNote(db: D1Database, given: RequestRow, note: string) {
  const r = await rootOf(db, given);
  await db.prepare("UPDATE requests SET ship_note = ?1, updated_at = ?2 WHERE id = ?3 OR linked_to = ?3").bind(note || null, Date.now(), r.id).run();
}

/**
 * Posts a reply as the team. The author and everyone who commented get it as a message in the
 * app, so the conversation goes both ways. In a private conversation that is only the one person.
 * With `everyone`, the same reply goes into each conversation linked to the request as well, so
 * every person who asked gets it in their own thread (nobody sees who else asked).
 */
export async function addTeamComment(
  db: D1Database,
  r: RequestRow,
  body: string,
  mail?: Mail,
  opts: { everyone?: boolean; images?: string[]; bucket?: R2Bucket } = {},
): Promise<{ id: string; notified: number; conversations: number }> {
  const targets = [r];
  if (opts.everyone) {
    const root = await rootOf(db, r);
    const { results } = await db.prepare("SELECT * FROM requests WHERE linked_to = ? ORDER BY created_at").bind(root.id).all<RequestRow>();
    targets.splice(0, 1, root, ...results);
  }
  let first = "";
  let notified = 0;
  for (const [i, target] of targets.entries()) {
    // The first conversation takes the uploaded files; every other one gets its own copy, so deleting
    // one conversation never takes an image away from another.
    const images = i === 0 ? (opts.images ?? []) : await copyImages(db, opts.bucket, opts.images ?? [], target);
    const out = await postTeamComment(db, target, body, mail, images);
    first ||= out.id;
    notified += out.notified;
  }
  return { id: first, notified, conversations: targets.length };
}

/** New upload rows (and R2 objects) for the same images, filed under another conversation. */
async function copyImages(db: D1Database, bucket: R2Bucket | undefined, ids: string[], r: RequestRow): Promise<string[]> {
  if (!bucket || !ids.length) return [];
  const out: string[] = [];
  for (const id of ids) {
    const object = await bucket.get(id);
    if (!object) continue;
    const copy = newId("upl", 24);
    const type = object.httpMetadata?.contentType ?? "image/png";
    await bucket.put(copy, await object.arrayBuffer(), { httpMetadata: { contentType: type } });
    await db.prepare("INSERT INTO uploads (id, app_id, user_id, content_type, size, created_at) VALUES (?, ?, 'team', ?, ?, ?)").bind(copy, r.app_id, type, object.size, Date.now()).run();
    out.push(copy);
  }
  return out;
}

async function postTeamComment(db: D1Database, r: RequestRow, body: string, mail?: Mail, images: string[] = []): Promise<{ id: string; notified: number }> {
  const id = newId("cmt");
  const t = Date.now();
  const results = await db.batch([
    db.prepare("INSERT INTO comments (id, request_id, user_id, is_team, body, created_at) VALUES (?, ?, NULL, 1, ?, ?)").bind(id, r.id, body, t),
    db.prepare("UPDATE requests SET comment_count = comment_count + 1, updated_at = ? WHERE id = ?").bind(t, r.id),
    db
      .prepare(
        `INSERT INTO notifications (id, user_id, request_id, kind, comment_id, created_at)
         SELECT 'ntf_' || lower(hex(randomblob(8))), who.uid, ?1, 'reply', ?2, ?3
         FROM (SELECT author_id AS uid FROM requests WHERE id = ?1
               UNION SELECT user_id FROM comments WHERE request_id = ?1 AND is_team = 0 AND user_id IS NOT NULL) who`,
      )
      .bind(r.id, id, t),
    ...images.map((u) => db.prepare("UPDATE uploads SET comment_id = ?, request_id = ? WHERE id = ?").bind(id, r.id, u)),
  ]);
  if (mail) mail.waitUntil(emailReply(mail.env, r, body, id, images));
  if (mail) mail.waitUntil(emitReply(mail, r, { id, body, images }));
  return { id, notified: results[2]?.meta.changes ?? 0 };
}

/** The team is finished with a conversation (or opens it again). The person writing again reopens it. */
export async function setDone(db: D1Database, r: RequestRow, done: boolean) {
  await db.prepare("UPDATE requests SET closed_at = ? WHERE id = ?").bind(done ? Date.now() : null, r.id).run();
}

/**
 * Folds a duplicate into another request. When either one is private, the duplicate is linked instead
 * (see linkRequests): merging would put one person's private words in front of the other.
 */
export async function mergeRequests(db: D1Database, from: RequestRow, into: RequestRow, mail?: Mail): Promise<{ linked: boolean }> {
  if (from.private || into.private) {
    await linkRequests(db, from, into, mail);
    return { linked: true };
  }
  const t = Date.now();
  await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO votes (request_id, user_id, created_at) SELECT ?, user_id, created_at FROM votes WHERE request_id = ?")
      .bind(into.id, from.id),
    // Votes carried over from another tool move with the merge.
    db.prepare("UPDATE requests SET imported_votes = imported_votes + ?2 WHERE id = ?1 AND ?2 > 0").bind(into.id, from.imported_votes ?? 0),
    // Private conversations filed under the duplicate follow it to the request that stays.
    db.prepare("UPDATE requests SET linked_to = ?1 WHERE linked_to = ?2").bind(into.id, from.id),
    recount(db, into.id, t),
    db.prepare("UPDATE requests SET status = 'merged', merged_into = ?, updated_at = ? WHERE id = ?").bind(into.id, t, from.id),
  ]);
  return { linked: false };
}

/**
 * Files a private conversation under another request. The person keeps their own conversation and
 * never sees the other one; their conversation takes the request's status from now on, and is told
 * when it ships. Anything already linked to `from` moves along with it. Linking to something that
 * already shipped tells them straight away.
 */
export async function linkRequests(db: D1Database, from: RequestRow, into: RequestRow, mail?: Mail): Promise<RequestRow> {
  let root = await rootOf(db, into);
  if (root.status === "merged" && root.merged_into) root = (await loadRequestById(db, root.app_id, root.merged_into)) ?? root;
  if (root.id === from.id) return root;
  const t = Date.now();
  const previous = from.linked_to && from.linked_to !== root.id ? from.linked_to : null;
  const mirrored = root.status === "pending" || root.status === "merged" ? "open" : root.status;
  await db.batch([
    db
      .prepare("UPDATE requests SET linked_to = ?1, status = ?2, ship_note = ?3, shipped_at = ?4, updated_at = ?5 WHERE id = ?6 OR linked_to = ?6")
      .bind(root.id, mirrored, root.ship_note, root.shipped_at, t, from.id),
    recount(db, root.id, t),
    ...(previous ? [recount(db, previous, t)] : []),
    ...(root.status === "shipped" ? [noticeLinked(db, root.id, t)] : []),
  ]);
  if (root.status === "shipped" && mail) mail.waitUntil(emailLinkedShipped(mail, root.id));
  return root;
}

/** Takes a conversation back out of the request it was filed under. It keeps the status it had. */
export async function unlinkRequest(db: D1Database, r: RequestRow) {
  if (!r.linked_to) return;
  const t = Date.now();
  await db.batch([db.prepare("UPDATE requests SET linked_to = NULL, updated_at = ? WHERE id = ?").bind(t, r.id), recount(db, r.linked_to, t)]);
}
