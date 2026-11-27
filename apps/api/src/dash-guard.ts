// Which dashboard calls are for owners and admins only, and the one path both the check and the admin router read.
//
// The session proxy (dash.ts) hands /v1/dash/apps/:appId/* to the admin router with the app's secret key. The
// router decodes percent-encoding before it routes, so the role check must look at the decoded path too: checking
// the raw path let "/%69ntegrations" past the check and onto "/integrations". So the path is decoded exactly once
// here, anything that could decode or normalise into something else afterwards is refused, and that same string
// is what gets checked and forwarded. Pure.

// Members triage (reply, set status, merge, approve, build). Settings, integrations (which hold tokens and
// webhook secrets), imports, exports and deleting requests are for owners and admins.
export const ADMIN_ONLY: [RegExp, string[]][] = [
  [/^\/app(\/avatar)?\/?$/, ["PATCH", "PUT", "POST", "DELETE"]],
  [/^\/integrations(\/|$)/, ["GET", "PUT", "POST", "PATCH", "DELETE"]],
  [/^\/(import|export|embeddings)(\/|$)/, ["GET", "POST", "PUT"]],
  [/^\/requests\/[^/]+\/?$/, ["DELETE"]],
  // Handing off starts a paid agent run in the owner's repo.
  [/^\/requests\/[^/]+\/handoff$/, ["POST"]],
];

/**
 * The path below /apps/:appId as the admin router will see it ("/integrations"), from the raw, still
 * percent-encoded one. null when it can't be read one single way: a malformed escape, an escape that decodes to
 * another escape, a backslash, a dot segment ("/a/../integrations" would be normalised on the way through), or a
 * control character.
 */
export function proxiedPath(rawRest: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(rawRest);
  } catch {
    return null;
  }
  if (!path.startsWith("/") && path !== "") return null;
  if (path.includes("%") || path.includes("\\")) return null;
  if (/(^|\/)\.{1,2}(\/|$)/.test(path)) return null;
  if (/[\u0000-\u001f\u007f]/.test(path)) return null;
  return path;
}

/** True when this method on this (decoded) path is for owners and admins only. */
export function adminOnly(path: string, method: string): boolean {
  const m = method.toUpperCase();
  return ADMIN_ONLY.some(([re, methods]) => re.test(path) && methods.includes(m));
}

/** The decoded path written back into a URL path, so the router decodes it to exactly `path` again. */
export const forwardPath = (path: string) => encodeURI(path);
