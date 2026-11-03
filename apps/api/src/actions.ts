// Things the team does to a request. The dashboard, Telegram and GitHub all go through here,
// so everyone who asked hears about it the same way whichever one was used.
import { newId } from "./lib";
import type { RequestRow, Status } from "./types";

export const ref = (r: Pick<RequestRow, "number">) => `YA-${r.number}`;

export async function loadRequestById(db: D1Database, appId: string, id: string): Promise<RequestRow | null> {
  return db.prepare("SELECT * FROM requests WHERE id = ? AND app_id = ?").bind(id, appId).first<RequestRow>();
}

export async function loadRequestByNumber(db: D1Database, appId: string, n: number): Promise<RequestRow | null> {
  return db.prepare("SELECT * FROM requests WHERE app_id = ? AND number = ?").bind(appId, n).first<RequestRow>();
}

/** Sets the status. Moving to shipped tells everyone who asked or voted, once per request. */
export async function setStatus(
  db: D1Database,
  r: RequestRow,
  status: Status,
  shipNote?: string | null,
): Promise<{ notified: number }> {
  const t = Date.now();
  const becameShipped = status === "shipped" && r.status !== "shipped";
  const note = shipNote === undefined ? r.ship_note : shipNote;
  const stmts = [
    db
      .prepare("UPDATE requests SET status = ?, ship_note = ?, shipped_at = ?, updated_at = ? WHERE id = ?")
      .bind(status, note, status === "shipped" ? (r.shipped_at ?? t) : null, t, r.id),
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
    );
  }
  const results = await db.batch(stmts);
  return { notified: becameShipped ? (results[1]?.meta.changes ?? 0) : 0 };
}

/** Takes a shipped request back to its previous status and withdraws notices nobody has seen yet. */
export async function undoShip(db: D1Database, r: RequestRow, previous: Status) {
  await db.batch([
    db.prepare("UPDATE requests SET status = ?, shipped_at = NULL, updated_at = ? WHERE id = ?").bind(previous, Date.now(), r.id),
    db.prepare("DELETE FROM notifications WHERE request_id = ? AND kind = 'shipped' AND seen_at IS NULL").bind(r.id),
  ]);
}

export async function setShipNote(db: D1Database, r: RequestRow, note: string) {
  await db.prepare("UPDATE requests SET ship_note = ?, updated_at = ? WHERE id = ?").bind(note || null, Date.now(), r.id).run();
}

/**
 * Posts a reply as the team. The author and everyone who commented get it as a message in the
 * app, so the conversation goes both ways.
 */
export async function addTeamComment(db: D1Database, r: RequestRow, body: string): Promise<{ id: string; notified: number }> {
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
  ]);
  return { id, notified: results[2]?.meta.changes ?? 0 };
}

export async function mergeRequests(db: D1Database, from: RequestRow, into: RequestRow) {
  const t = Date.now();
  await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO votes (request_id, user_id, created_at) SELECT ?, user_id, created_at FROM votes WHERE request_id = ?")
      .bind(into.id, from.id),
    db
      .prepare("UPDATE requests SET vote_count = (SELECT COUNT(*) FROM votes WHERE request_id = ?1), updated_at = ?2 WHERE id = ?1")
      .bind(into.id, t),
    db.prepare("UPDATE requests SET status = 'merged', merged_into = ?, updated_at = ? WHERE id = ?").bind(into.id, t, from.id),
  ]);
}
