import { useState, type CSSProperties } from "react";
import { useInternal, type Route } from "./context";
import { IconCheck, IconChevron, IconIdea, IconSend } from "./icons";
import { AppAvatar, RequestRow, Skeleton, useLoad } from "./shared";
import { Navigator } from "./views";

// Inline entry points. Each renders inside your layout (not a portal) and opens the same sheet.

type Common = { className?: string; style?: CSSProperties };

function useScope(className?: string, style?: CSSProperties) {
  const { scope } = useInternal();
  return {
    className: `${scope.className} ya-inline${className ? ` ${className}` : ""}`,
    style: { ...scope.style, ...style },
    "data-ya-mode": scope["data-ya-mode"],
  };
}

/** A chat-style input bar. Tapping it opens the composer. Good at the top of a home screen or under an empty state. */
export function AskBar({ placeholder = "Ask for a feature…", className, style }: Common & { placeholder?: string }) {
  const { open, appIcon, unseenCount } = useInternal();
  return (
    <div {...useScope(className, style)}>
      <button type="button" className="ya-askbar" onClick={() => open({ view: "new" })}>
        {appIcon ? (
          <AppAvatar icon={appIcon} size={30} />
        ) : (
          <span className="ya-askbar-glyph" aria-hidden="true">
            <IconIdea />
          </span>
        )}
        <span className="ya-askbar-text">{placeholder}</span>
        {unseenCount > 0 && <span className="ya-badge">{unseenCount}</span>}
        <span className="ya-askbar-send" aria-hidden="true">
          <IconSend />
        </span>
      </button>
    </div>
  );
}

/** A card with the top requests and vote buttons, for a dashboard or home tab. */
export function FeatureCard({
  heading = "Shape what's next",
  description = "Vote on ideas or suggest your own",
  limit = 3,
  className,
  style,
}: Common & { heading?: string; description?: string; limit?: number }) {
  const { client, open, config, markSeen } = useInternal();
  const { data } = useLoad(() => client.list("top", "active"), [client]);
  const notice = config?.unseen.find((n) => n.kind === "shipped");
  return (
    <div {...useScope(className, style)}>
      <section className="ya-card">
        <div className="ya-card-head">
          <span className="ya-card-icon" aria-hidden="true">
            <IconIdea />
          </span>
          <div>
            <h3 className="ya-card-title">{heading}</h3>
            <p className="ya-card-sub">{description}</p>
          </div>
        </div>
        {notice && (
          <button
            type="button"
            className="ya-card-win"
            onClick={() => {
              markSeen([notice.id]);
              open({ requestId: notice.requestId });
            }}
          >
            <span className="ya-shipped-dot">
              <IconCheck />
            </span>
            <span>
              You asked for <b>{notice.title}</b>. It's live.
            </span>
            <IconChevron />
          </button>
        )}
        {!data ? (
          <Skeleton rows={2} />
        ) : data.length > 0 ? (
          <ul className="ya-list">
            {data.slice(0, limit).map((r) => (
              <RequestRow key={r.id} client={client} request={r} compact onOpen={() => open({ requestId: r.id })} />
            ))}
          </ul>
        ) : null}
        <div className="ya-card-actions">
          <button type="button" className="ya-btn ya-btn-sm" onClick={() => open({ view: "new" })}>
            Suggest an idea
          </button>
          {data && data.length > limit && (
            <button type="button" className="ya-btn ya-btn-sm ya-btn-ghost" onClick={() => open({ view: "board" })}>
              See all {data.length}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * A button for your own toolbar or menu.
 * - "pill": tinted pill with an icon and label
 * - "icon": round icon button, e.g. in a header
 * - "row": a settings-style row with a chevron
 */
export function RequestButton({
  variant = "pill",
  label = "Request a feature",
  sublabel = "Vote on what we build next",
  className,
  style,
}: Common & { variant?: "pill" | "icon" | "row"; label?: string; sublabel?: string }) {
  const { open, unseenCount } = useInternal();
  const scope = useScope(className, style);
  const badge = unseenCount > 0 && (variant === "icon" ? <span className="ya-dot" aria-hidden="true" /> : <span className="ya-badge">{unseenCount}</span>);
  if (variant === "icon") {
    return (
      <span {...scope}>
        <button type="button" className="ya-iconbtn" onClick={() => open()} aria-label={label}>
          <IconIdea />
          {badge}
        </button>
      </span>
    );
  }
  if (variant === "row") {
    return (
      <div {...scope}>
        <button type="button" className="ya-menurow" onClick={() => open()}>
          <span className="ya-card-icon" aria-hidden="true">
            <IconIdea />
          </span>
          <span className="ya-menurow-text">
            <span className="ya-menurow-label">{label}</span>
            {sublabel && <span className="ya-menurow-sub">{sublabel}</span>}
          </span>
          {badge}
          <IconChevron />
        </button>
      </div>
    );
  }
  return (
    <span {...scope}>
      <button type="button" className="ya-pillbtn" onClick={() => open()}>
        <IconIdea />
        {label}
        {badge}
      </button>
    </span>
  );
}

/**
 * A quiet line next to a feature: "Want more from charts?". Opens the composer already about that
 * topic, and the request is saved with it so you can see which feature people are asking about.
 */
export function AskAbout({
  topic,
  prompt,
  className,
  style,
}: Common & { topic: string; prompt?: string }) {
  const { open } = useInternal();
  return (
    <span {...useScope(className, style)}>
      <button type="button" className="ya-askabout" onClick={() => open({ view: "new", topic })}>
        <IconIdea />
        {prompt ?? `Want more from ${topic}?`}
      </button>
    </span>
  );
}

/**
 * For an empty search: "Can't find “export”? Ask for it". Opens the composer with the search as the
 * draft, tagged as a search so you can tell what people looked for and didn't find.
 */
export function AskForIt({ query, className, style }: Common & { query: string }) {
  const { open } = useInternal();
  const q = query.trim();
  const shown = q.length > 40 ? `${q.slice(0, 39).trimEnd()}…` : q;
  return (
    <span {...useScope(className, style)}>
      <button type="button" className="ya-askforit" onClick={() => open({ view: "new", draft: q, topic: "search" })}>
        <span>{shown ? `Can't find “${shown}”?` : "Can't find it?"}</span>
        <b>
          Ask for it
          <IconChevron />
        </b>
      </button>
    </span>
  );
}

/** The whole experience inline, for a /feedback page or a tab. */
export function FeatureBoard({
  start = "home",
  height = "min(720px, 80vh)",
  className,
  style,
}: Common & { start?: "home" | "board"; height?: number | string }) {
  const [route, setRoute] = useState<Route>(start === "board" ? { view: "board" } : { view: "home" });
  return (
    <div {...useScope(className, style)}>
      <div className="ya-embed" style={{ height }}>
        <Navigator route={route} setRoute={setRoute} />
      </div>
    </div>
  );
}
