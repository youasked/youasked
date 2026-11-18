// The corner message as the SDK draws it, for the homepage: a text from the person who made the app,
// with a reply box under it. Drawn here (not the live widget) because the SDK's version is fixed to
// the window, and these sit inside a phone or a tile.
export function MessageCard({ text, className = "", onOpen, onClose }: { text: string; className?: string; onOpen?: () => void; onClose?: () => void }) {
  return (
    <div className={`ph-msg ${className}`} role="status">
      {onClose ? <button type="button" className="ph-msg-x" aria-label="Dismiss" onClick={onClose} /> : <span className="ph-msg-x" aria-hidden="true" />}
      <div className="ph-msg-row">
        <span className="ph-msg-avatar" aria-hidden="true">
          S
        </span>
        <div className="ph-msg-bubble" onClick={onOpen}>
          <span className="ph-msg-from">
            <b>Sam</b>
            <span>Made this app</span>
          </span>
          <p className="ph-msg-text" key={text}>
            {text}
          </p>
        </div>
      </div>
      <div className="ph-msg-reply" onClick={onOpen}>
        <span>Reply to Sam…</span>
        <i aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15">
            <path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </i>
      </div>
    </div>
  );
}
