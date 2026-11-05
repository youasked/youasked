// "Show us": a full-screen layer over the host page where you drag boxes around what you mean.
// Loaded on demand (it carries the screenshot library), so the main bundle stays small.
import { domToCanvas } from "modern-screenshot";
import { useEffect, useRef, useState } from "react";

type Box = { x: number; y: number; w: number; h: number };

const MAX_BOXES = 6;
const MAX_WIDTH = 1600;
/** Smaller than this and it was a tap, not a drag. */
const MIN_SIDE = 14;

/**
 * Two steps. First a small bar floats over the page while the person goes where the problem is:
 * the page is fully usable, so they can navigate, scroll and open menus. Then "Capture" freezes
 * that screen for marking it up, which is the Mark step below.
 */
export default function Capture({ onDone, onCancel }: { onDone: (image: Blob) => void; onCancel: () => void }) {
  const [phase, setPhase] = useState<"find" | "mark">("find");
  if (phase === "find") return <Find onCapture={() => setPhase("mark")} onCancel={onCancel} />;
  return <Mark onDone={onDone} onCancel={onCancel} onBack={() => setPhase("find")} />;
}

function Find({ onCapture, onCancel }: { onCapture: () => void; onCancel: () => void }) {
  const captureRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    captureRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);
  return (
    <div className="ya-capture-find" role="dialog" aria-label="Show us what you mean">
      <p>
        <b>Go to what you want to show us,</b> then capture it.
      </p>
      <div className="ya-capture-find-actions">
        <button type="button" className="ya-btn ya-btn-sm ya-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="ya-btn ya-btn-sm" onClick={onCapture} ref={captureRef}>
          Capture
        </button>
      </div>
    </div>
  );
}

function Mark({ onDone, onCancel, onBack }: { onDone: (image: Blob) => void; onCancel: () => void; onBack: () => void }) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [drawing, setDrawing] = useState<Box | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const sampleRef = useRef<HTMLSpanElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    doneRef.current?.focus({ preventScroll: true });
    // The page stays where it is, so what you circle is what gets captured.
    const stop = (e: WheelEvent) => e.preventDefault();
    window.addEventListener("wheel", stop, { passive: false });
    return () => window.removeEventListener("wheel", stop);
  }, []);

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      // Let "Capturing…" paint before the page is read.
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
      onDone(await capturePage(boxes, sampleRef.current ? getComputedStyle(sampleRef.current).color : "#2b4bee"));
    } catch (err) {
      console.error("youasked: couldn't capture the page", err);
      setBusy(false);
      setFailed(true);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      } else if (e.key === "Enter" && !(e.target as Element).closest?.("button")) {
        e.preventDefault();
        void finish();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  const rect = (a: { x: number; y: number }, e: React.PointerEvent): Box => ({
    x: Math.min(a.x, e.clientX),
    y: Math.min(a.y, e.clientY),
    w: Math.abs(e.clientX - a.x),
    h: Math.abs(e.clientY - a.y),
  });

  return (
    <div className="ya-capture" role="dialog" aria-label="Show us what you mean" data-busy={busy || undefined}>
      <span className="ya-capture-sample" ref={sampleRef} aria-hidden="true" />
      <div
        className="ya-capture-surface"
        onPointerDown={(e) => {
          if (busy || e.button !== 0 || boxes.length >= MAX_BOXES) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = { x: e.clientX, y: e.clientY };
          setDrawing({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
        }}
        onPointerMove={(e) => start.current && setDrawing(rect(start.current, e))}
        onPointerUp={(e) => {
          if (!start.current) return;
          const box = rect(start.current, e);
          start.current = null;
          setDrawing(null);
          if (box.w >= MIN_SIDE && box.h >= MIN_SIDE) setBoxes((b) => [...b, box]);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDrawing(null);
        }}
      >
        {[...boxes, ...(drawing ? [drawing] : [])].map((b, i) => (
          <div key={i} className="ya-capture-box" style={{ left: b.x, top: b.y, width: b.w, height: b.h }} />
        ))}
      </div>
      <p className="ya-capture-hint" role="status">
        {failed
          ? "Couldn't capture this page. Try again, or cancel."
          : boxes.length === 0
            ? "Drag to circle what you mean, or press Done for the whole screen"
            : boxes.length >= MAX_BOXES
              ? "That's enough boxes. Press Done."
              : "Add another, or press Done"}
      </p>
      <div className="ya-capture-bar">
        <button type="button" className="ya-btn ya-btn-sm ya-btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        {boxes.length === 0 && !busy && (
          <button type="button" className="ya-btn ya-btn-sm ya-btn-ghost" onClick={onBack}>
            Back
          </button>
        )}
        {boxes.length > 0 && !busy && (
          <button type="button" className="ya-btn ya-btn-sm ya-btn-ghost" onClick={() => setBoxes((b) => b.slice(0, -1))}>
            Undo
          </button>
        )}
        <button type="button" className="ya-btn ya-btn-sm" onClick={finish} disabled={busy} ref={doneRef}>
          {busy ? "Capturing…" : "Done"}
        </button>
      </div>
    </div>
  );
}

function pageBackground(): string {
  for (const el of [document.body, document.documentElement]) {
    const c = getComputedStyle(el).backgroundColor;
    if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) return c;
  }
  return "#ffffff";
}

/** What's on screen now, with the boxes drawn on, shrunk to at most 1600px wide. */
async function capturePage(boxes: Box[], accent: string): Promise<Blob> {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const scale = Math.min(window.devicePixelRatio || 1, MAX_WIDTH / w);
  const page = await domToCanvas(document.documentElement, {
    width: w,
    height: h,
    scale,
    backgroundColor: pageBackground(),
    // Shift the page up and left by how far it's scrolled, on a root tall enough to still reach the bottom of the screen.
    onCloneNode: (clone) => {
      const style = (clone as HTMLElement).style;
      style.width = `${w + window.scrollX}px`;
      style.height = `${h + window.scrollY}px`;
      style.transformOrigin = "0 0";
      style.transform = `translate(${-window.scrollX}px, ${-window.scrollY}px)`;
    },
    // The widget's own layers (marked data-ya-skip) are never part of the picture.
    filter: (node) => !(node instanceof Element && node.hasAttribute("data-ya-skip")),
  });

  // Draw at a size we choose, whatever the library handed back.
  const k = Math.min(1, MAX_WIDTH / page.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(page.width * k);
  canvas.height = Math.round(page.height * k);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(page, 0, 0, canvas.width, canvas.height);

  if (boxes.length) {
    const f = canvas.width / w;
    const rects = boxes.map((b) => [b.x * f, b.y * f, b.w * f, b.h * f] as const);
    // Dim everything except the boxes, then outline them.
    ctx.save();
    ctx.fillStyle = "rgba(8, 10, 20, 0.4)";
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    for (const [x, y, bw, bh] of rects) ctx.roundRect(x, y, bw, bh, 8 * f);
    ctx.fill("evenodd");
    ctx.restore();
    for (const [x, y, bw, bh] of rects) {
      ctx.beginPath();
      ctx.roundRect(x, y, bw, bh, 8 * f);
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(255,255,255,.95)";
      ctx.lineWidth = 6.5 * f;
      ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3.5 * f;
      ctx.stroke();
    }
  }
  return encode(canvas);
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** WebP where the browser can write it, JPEG otherwise (Safari), kept well under the 2 MB limit. */
async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  let blob = await toBlob(canvas, "image/webp", 0.8);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", 0.8);
  if (blob && blob.size > 1_800_000) blob = (await toBlob(canvas, "image/jpeg", 0.6)) ?? blob;
  if (!blob) throw new Error("encode_failed");
  return blob;
}
