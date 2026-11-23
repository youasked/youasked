// A message from a real person on the team. The corner pop-up reads like a text ("Hey! Got an idea…?")
// from the developer's own photo and name, and the chat opens with their welcome note. Set up in the
// dashboard under "Message from you", or with the `persona` prop.
import { useEffect, useState } from "react";
import { IconClose, IconSend } from "./icons";

export type Persona = {
  /** Shown above the message, e.g. "Aden". */
  name: string | null;
  /** A short line next to the name, e.g. "Made Keep This Day". */
  role: string | null;
  /** Square photo URL. Without one, their initial (or the app's icon) is shown. */
  avatar: string | null;
  /** The first message when the chat opens: who you are and how you help. */
  intro: string | null;
};

const EMPTY: Persona = { name: null, role: null, avatar: null, intro: null };

/** The dashboard's persona with the prop on top. false turns it off; nothing set means null. */
export function resolvePersona(server: Persona | null | undefined, prop: Partial<Persona> | false | undefined): Persona | null {
  if (prop === false) return null;
  const p = { ...EMPTY, ...(server ?? {}), ...(prop ?? {}) };
  return p.name || p.role || p.avatar || p.intro ? p : null;
}

/** The pop-up's words when the developer hasn't written their own. */
export function defaultMessage(appName: string, persona: Persona | null): string {
  return `Hey! Got an idea for ${appName}, or something not working? Tell ${persona?.name ? "me" : "us"} here.`;
}

const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] ?? null;

/** Their photo, else the app's icon, else their initial on the accent colour. */
export function PersonaAvatar({ persona, appIcon, appName, size = 36 }: { persona: Persona | null; appIcon: string | null; appName: string; size?: number }) {
  const src = persona?.avatar ?? (persona?.name ? null : appIcon);
  const [failed, setFailed] = useState<string | null>(null);
  const style = { width: size, height: size };
  if (src && failed !== src) {
    return <img className="ya-persona" src={src} alt="" width={size} height={size} style={style} onError={() => setFailed(src)} />;
  }
  const letter = (persona?.name ?? appName).trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="ya-persona ya-persona-initial" style={{ ...style, fontSize: Math.round(size * 0.44) }} aria-hidden="true">
      {letter}
    </span>
  );
}

const prefersReducedMotion = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/**
 * The corner pop-up: their photo, a chat bubble with their name and message, and a "Reply" pill that
 * opens the chat. It "types" for a moment first, like a real message arriving.
 */
export function MessagePopup({
  persona,
  text,
  appName,
  appIcon,
  position,
  trigger,
  place,
  onOpen,
  onDismiss,
}: {
  persona: Persona | null;
  text: string;
  appName: string;
  appIcon: string | null;
  position: string;
  trigger: string;
  place: "bottom" | "top";
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const [typing, setTyping] = useState(() => !prefersReducedMotion());
  useEffect(() => {
    if (!typing) return;
    const t = window.setTimeout(() => setTyping(false), 1100);
    return () => window.clearTimeout(t);
  }, [typing]);
  const who = persona?.name ?? appName;
  const first = firstName(persona?.name ?? null);
  return (
    <div className="ya-cmsg" role="status" aria-live="polite" data-pos={position} data-trigger={trigger} data-place={place} data-typing={typing || undefined}>
      <button type="button" className="ya-msg-close" onClick={onDismiss} aria-label="Dismiss">
        <IconClose />
      </button>
      <div className="ya-msg-row">
        <PersonaAvatar persona={persona} appIcon={appIcon} appName={appName} size={38} />
        <button type="button" className="ya-msg-bubble" onClick={onOpen} aria-label={`Message from ${who}: ${text}. Reply`}>
          <span className="ya-msg-from">
            <b>{who}</b>
            {persona?.role && <span>{persona.role}</span>}
          </span>
          {typing ? (
            <span className="ya-typing" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          ) : (
            <span className="ya-msg-text">{text}</span>
          )}
        </button>
      </div>
      <button type="button" className="ya-msg-reply" onClick={onOpen}>
        <span>{first ? `Reply to ${first}…` : "Reply…"}</span>
        <span className="ya-msg-send" aria-hidden="true">
          <IconSend />
        </span>
      </button>
    </div>
  );
}

/** Who the chat's first messages come from, above their bubbles. */
export function MessageFrom({ persona, appName, appIcon }: { persona: Persona; appName: string; appIcon: string | null }) {
  return (
    <div className="ya-from">
      <PersonaAvatar persona={persona} appIcon={appIcon} appName={appName} size={30} />
      <span className="ya-from-text">
        <b>{persona.name ?? appName}</b>
        {persona.role && <span>{persona.role}</span>}
      </span>
    </div>
  );
}
