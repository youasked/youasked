// The reply box in a conversation: text, plus up to 4 images (pick, paste or drop them on the box).
import { useEffect, useRef, useState } from "react";
import { IconClose, IconImage, IconSend } from "./icons";
import { errorText } from "./shared";
import { YouAskedError } from "./client";

export const MAX_REPLY_IMAGES = 4;
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

type Picked = { id: number; blob: Blob; url: string };
let nextId = 1;

/** Sends the text and the images (already uploaded; ids). Throw to show an error and keep the draft. */
export function ReplyBar({
  placeholder,
  label,
  upload,
  onSend,
}: {
  placeholder: string;
  label: string;
  upload: (image: Blob) => Promise<string>;
  onSend: (text: string, attachments: string[]) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => pickedRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const add = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    const ok = images.filter((f) => TYPES.includes(f.type));
    if (ok.length < images.length) setError("Use a PNG, JPEG or WebP image.");
    else if (ok.some((f) => f.size > MAX_BYTES)) setError("Images can be up to 2 MB each.");
    else setError(null);
    const fit = ok.filter((f) => f.size <= MAX_BYTES);
    setPicked((cur) => [...cur, ...fit.slice(0, Math.max(0, MAX_REPLY_IMAGES - cur.length)).map((blob) => ({ id: nextId++, blob, url: URL.createObjectURL(blob) }))]);
  };
  const remove = (id: number) =>
    setPicked((cur) => {
      cur.filter((p) => p.id === id).forEach((p) => URL.revokeObjectURL(p.url));
      return cur.filter((p) => p.id !== id);
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && !picked.length) || sending) return;
    setSending(true);
    setError(null);
    try {
      const ids = await Promise.all(picked.map((p) => upload(p.blob)));
      await onSend(text, ids);
      picked.forEach((p) => URL.revokeObjectURL(p.url));
      setPicked([]);
      setText("");
    } catch (err) {
      const code = err instanceof YouAskedError ? err.code : "network";
      setError(code === "too_large" ? "Images can be up to 2 MB each." : code === "bad_image" ? "Use a PNG, JPEG or WebP image." : errorText(code, err instanceof YouAskedError ? err.detail : undefined));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`ya-replybar${over ? " ya-replybar-over" : ""}`}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          add(Array.from(e.dataTransfer.files));
        }
      }}
    >
      {picked.length > 0 && (
        <ul className="ya-shots ya-reply-shots" aria-label="Images to send">
          {picked.map((p, i) => (
            <li key={p.id} className="ya-shot ya-reply-shot">
              <img src={p.url} alt={`Image ${i + 1}`} />
              <button type="button" className="ya-shot-x" aria-label={`Remove image ${i + 1}`} onClick={() => remove(p.id)} disabled={sending}>
                <IconClose />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="ya-composer ya-composer-bar" onSubmit={submit}>
        <textarea
          className="ya-composer-input"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          maxLength={1000}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.some((f) => f.type.startsWith("image/"))) {
              e.preventDefault();
              add(files);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
            }
          }}
        />
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => {
            add(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="ya-attach"
          aria-label="Attach an image"
          disabled={sending || picked.length >= MAX_REPLY_IMAGES}
          onClick={() => input.current?.click()}
        >
          <IconImage />
        </button>
        <button type="submit" className="ya-send" disabled={(!text.trim() && !picked.length) || sending} aria-label={`Send ${label.toLowerCase()}`}>
          <IconSend />
        </button>
      </form>
      {error && (
        <p className="ya-note ya-reply-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
