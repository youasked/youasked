import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { YouAskedError, type Client, type FeatureRequest, type Status } from "./client";
import { IconBack, IconChat, IconCheck, IconClose, IconUp } from "./icons";

export function useVote(client: Client, initial: FeatureRequest) {
  const [state, setState] = useState({ voted: initial.voted, votes: initial.votes });
  const busy = useRef(false);
  useEffect(() => setState({ voted: initial.voted, votes: initial.votes }), [initial.voted, initial.votes]);
  const toggle = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const before = state;
    setState({ voted: !before.voted, votes: before.votes + (before.voted ? -1 : 1) });
    try {
      setState(await client.vote(initial.id));
    } catch {
      setState(before);
    } finally {
      busy.current = false;
    }
  }, [client, initial.id, state]);
  return { ...state, toggle };
}

export function VoteButton({ client, request, compact }: { client: Client; request: FeatureRequest; compact?: boolean }) {
  const { voted, votes, toggle } = useVote(client, request);
  return (
    <button
      type="button"
      className={compact ? "ya-vote ya-vote-sm" : "ya-vote"}
      aria-pressed={voted}
      aria-label={`${voted ? "Remove vote" : "Upvote"}: ${request.title}. ${votes} ${votes === 1 ? "vote" : "votes"}`}
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
    >
      <IconUp />
      {votes}
    </button>
  );
}

export function BigVote({
  client,
  request,
  onChange,
}: {
  client: Client;
  request: FeatureRequest;
  onChange?: (voted: boolean) => void;
}) {
  const { voted, votes, toggle } = useVote(client, request);
  useEffect(() => onChange?.(voted), [voted, onChange]);
  return (
    <button type="button" className="ya-bigvote" aria-pressed={voted} onClick={toggle}>
      <IconUp />
      {voted ? "Voted" : "Upvote"} · {votes}
    </button>
  );
}

export const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In progress",
  shipped: "Shipped",
  declined: "Not planned",
  pending: "Awaiting approval",
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className="ya-pill" data-s={status}>
      {status === "shipped" && <IconCheck />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function RequestRow({
  client,
  request,
  onOpen,
  compact,
}: {
  client: Client;
  request: FeatureRequest;
  onOpen: () => void;
  compact?: boolean;
}) {
  return (
    <li className={compact ? "ya-row ya-row-sm" : "ya-row"}>
      <VoteButton client={client} request={request} compact={compact} />
      <button type="button" className="ya-row-main" onClick={onOpen}>
        <span className="ya-row-title">{request.title}</span>
        {(request.status !== "open" || request.comments > 0 || request.mine) && (
          <span className="ya-meta">
            {request.status !== "open" && <StatusPill status={request.status} />}
            {request.comments > 0 && (
              <span>
                <IconChat />
                {request.comments}
              </span>
            )}
            {request.mine && <span>You asked</span>}
          </span>
        )}
      </button>
    </li>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="ya-list" aria-label="Loading" role="status">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ya-skel" />
      ))}
    </div>
  );
}

export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    load()
      .then((d) => alive && setData(d))
      .catch((e: unknown) => alive && setError(e instanceof YouAskedError ? e.code : "network"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error, setData };
}

export function errorText(code: string | null, detail?: string): string {
  if (detail) return detail;
  switch (code) {
    case "signature_required":
    case "bad_signature":
      return "We couldn't confirm who you are. Refresh the page and try again.";
    case "slow_down":
      return "That's a lot of requests in an hour. Try again a bit later.";
    case "looks_like_spam":
      return "That looks like spam, so we didn't post it. Reword it and try again.";
    case "title_too_short":
      return "Add a few more words so others know what you mean.";
    case "network":
      return "Couldn't reach the server. Check your connection and try again.";
    default:
      return "Something went wrong. Try again.";
  }
}

export function whatsNewHeading(total: number): string {
  return `${total} ${total === 1 ? "thing" : "things"} shipped since your last visit`;
}

export function ago(t: number): string {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The app's own icon, or nothing. A guessed letter tile looks generic, so it's never drawn. */
export function AppAvatar({ icon, size = 36 }: { icon?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!icon || failed) return null;
  return (
    <img
      className="ya-avatar"
      src={icon}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}

export function Header({
  title,
  subtitle,
  leading,
  onBack,
  onClose,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  onBack?: () => void;
  onClose?: () => void;
  right?: ReactNode;
}) {
  return (
    <div className={onBack ? "ya-head ya-head-back" : "ya-head"}>
      {onBack && (
        <button type="button" className="ya-icon-btn" onClick={onBack} aria-label="Back">
          <IconBack />
        </button>
      )}
      {leading}
      <div className="ya-head-text">
        <h2 className="ya-h">{title}</h2>
        {subtitle && <p className="ya-sub">{subtitle}</p>}
      </div>
      {right}
      {onClose && (
        <button type="button" className="ya-icon-btn" onClick={onClose} aria-label="Close">
          <IconClose />
        </button>
      )}
    </div>
  );
}
