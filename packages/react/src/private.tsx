// Private mode: each person's own conversations with the team, like a support chat inside the app.
// Nobody sees anyone else's requests or votes, so these rows show what was said, not a vote count.
import type { FeatureRequest } from "./client";
import { IconLock } from "./icons";
import { StatusPill, ago } from "./shared";

/** One conversation: what it's about, the last word in it, and whether a reply is waiting. */
export function ConversationRow({ request, appName, onOpen }: { request: FeatureRequest; appName: string; onOpen: () => void }) {
  const last = request.last ?? { body: request.body || request.title, team: false, at: request.createdAt };
  const who = last.team ? appName : "You";
  return (
    <li>
      <button type="button" className="ya-convo" data-unread={request.unread || undefined} onClick={onOpen}>
        <span className="ya-convo-top">
          <span className="ya-convo-title">{request.title}</span>
          <time className="ya-convo-when" dateTime={new Date(last.at).toISOString()}>
            {ago(last.at)}
          </time>
        </span>
        <span className="ya-convo-bottom">
          <span className="ya-convo-last">
            <span className="ya-convo-who">{who}:</span> {oneLine(last.body)}
          </span>
          {request.unread ? (
            <span className="ya-unread" aria-label="New reply" />
          ) : request.status !== "open" ? (
            <StatusPill status={request.status} />
          ) : null}
        </span>
      </button>
    </li>
  );
}

export function ConversationList({ requests, appName, onOpen }: { requests: FeatureRequest[]; appName: string; onOpen: (id: string) => void }) {
  return (
    <ul className="ya-convos">
      {requests.map((r) => (
        <ConversationRow key={r.id} request={r} appName={appName} onOpen={() => onOpen(r.id)} />
      ))}
    </ul>
  );
}

/** The promise private mode makes, said where people decide what to write. */
export function LockNote({ appName, children }: { appName: string; children?: React.ReactNode }) {
  return (
    <p className="ya-lock-note">
      <IconLock />
      <span>{children ?? `Private. Only you and the ${appName} team can see these.`}</span>
    </p>
  );
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
