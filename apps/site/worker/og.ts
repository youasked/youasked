// The "You asked, it's live" share card: 1200x630 PNG drawn with satori (layout to SVG) and resvg (SVG to PNG),
// both running as WebAssembly inside the worker. Latin text only: other scripts have no glyphs in these fonts.
import { Resvg, initWasm as initResvg } from "@resvg/resvg-wasm";
import satori, { init as initYoga } from "satori/standalone";
import resvgWasm from "./vendor/resvg.wasm";
import yogaWasm from "./vendor/yoga.wasm";
import display700 from "./vendor/display-700.woff";
import body400 from "./vendor/body-400.woff";
import body600 from "./vendor/body-600.woff";

// satori's layout engine is an emscripten build that wants wasm bytes and compiles them itself, which
// Workers forbid. Hand it a placeholder and answer its WebAssembly.instantiate call with the precompiled module.
// satori copies what it is given, so recognise the placeholder by shape rather than identity.
const isPlaceholder = (s: unknown) => ArrayBuffer.isView(s) && s.byteLength === 1;

async function initYogaPrecompiled() {
  const placeholder = new Uint8Array([0]);
  const original = WebAssembly.instantiate;
  WebAssembly.instantiate = (async (source: unknown, imports?: WebAssembly.Imports) =>
    isPlaceholder(source)
      ? { instance: await original(yogaWasm, imports), module: yogaWasm }
      : original(source as never, imports)) as typeof WebAssembly.instantiate;
  // The patch stays in place: it only answers for the placeholder and passes everything else through.
  await initYoga(placeholder as never);
}

let ready: Promise<unknown> | undefined;
const init = () => (ready ??= Promise.all([initYogaPrecompiled(), initResvg(resvgWasm)]));

export type Card = { app: string; title: string; note: string | null; people: number };

// The same speech-bubble mark as the site, as an image.
const MARK = `data:image/svg+xml;base64,${btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#6d84ff"/><stop offset="1" stop-color="#2b4bee"/></linearGradient></defs><path d="M11.4 3.2c-4.97 0-9 3.47-9 7.75 0 2.3 1.17 4.37 3.03 5.8L4.6 20.2l4.1-2.06c.86.2 1.76.31 2.7.31 4.97 0 9-3.47 9-7.75S16.37 3.2 11.4 3.2Z" fill="url(#g)"/><path d="m7.9 11.2 2.5 2.4 4.7-4.7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="19.4" cy="4.4" r="2.6" fill="#ffe066" stroke="#0b1020" stroke-width="1.3"/></svg>',
)}`;

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style: { display: "flex", ...style }, children, ...extra },
});

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function layout(card: Card): Node {
  const title = clip(card.title, 110);
  const titleSize = title.length <= 36 ? 50 : title.length <= 70 ? 42 : 34;
  const app = clip(card.app, 32);
  const people = `${card.people} ${card.people === 1 ? "person" : "people"} asked`;
  return h(
    "div",
    {
      width: 1200,
      height: 630,
      padding: 80,
      justifyContent: "space-between",
      color: "#f6f7fb",
      fontFamily: "Instrument Sans",
      backgroundColor: "#0b1020",
      backgroundImage: "radial-gradient(circle at 92% 8%, rgba(58,82,240,0.55) 0%, rgba(11,16,32,0) 55%), radial-gradient(circle at 95% 105%, rgba(255,224,102,0.16) 0%, rgba(11,16,32,0) 40%)",
    },
    [
      h("div", { flexDirection: "column", justifyContent: "space-between", width: 470 }, [
        h("div", { alignItems: "center", gap: 14 }, [
          h("img", {}, undefined, { src: MARK, width: 52, height: 52 }),
          h("div", { fontFamily: "Bricolage Grotesque", fontWeight: 700, fontSize: 42, letterSpacing: -1.2 }, "YouAsked"),
        ]),
        h("div", { flexDirection: "column", fontFamily: "Bricolage Grotesque", fontWeight: 700, fontSize: 84, lineHeight: 1, letterSpacing: -3.5 }, [
          h("div", {}, "You asked."),
          h("div", {}, "It's live."),
        ]),
        h(
          "div",
          { alignItems: "center", alignSelf: "flex-start", padding: "14px 22px", borderRadius: 16, backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 26, color: "#c9d1ef" },
          "youasked.dev",
        ),
      ]),
      h(
        "div",
        { flexDirection: "column", justifyContent: "center", width: 540, padding: "36px 40px", borderRadius: 36, backgroundColor: "#ffffff", color: "#0b1020", gap: 16 },
        [
          h("div", { alignItems: "center", gap: 10, alignSelf: "flex-start", padding: "8px 18px", borderRadius: 999, backgroundColor: "#e5f7ec", color: "#15803d", fontWeight: 600, fontSize: 24 }, [
            h("div", { width: 12, height: 12, borderRadius: 6, backgroundColor: "#16a34a" }),
            h("div", {}, `It's live in ${app}`),
          ]),
          h("div", { fontFamily: "Bricolage Grotesque", fontWeight: 700, fontSize: titleSize, lineHeight: 1.1, letterSpacing: -1.2, lineClamp: 4 }, title),
          card.note ? h("div", { fontSize: 25, lineHeight: 1.4, color: "#5b6380", lineClamp: 3 }, clip(card.note, 140)) : h("div", {}),
          h("div", { alignItems: "center", gap: 14, marginTop: 6 }, [
            h("div", {}, [
              h("div", { width: 34, height: 34, borderRadius: 17, backgroundColor: "#ffb4a2" }),
              h("div", { width: 34, height: 34, borderRadius: 17, backgroundColor: "#a5c4ff", marginLeft: -10 }),
              h("div", { width: 34, height: 34, borderRadius: 17, backgroundColor: "#ffe066", marginLeft: -10 }),
            ]),
            h("div", { fontSize: 26, fontWeight: 600, color: "#283048" }, people),
          ]),
        ],
      ),
    ],
  );
}

export async function renderCard(card: Card): Promise<Uint8Array> {
  await init();
  const svg = await satori(layout(card) as never, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Bricolage Grotesque", data: display700, weight: 700, style: "normal" },
      { name: "Instrument Sans", data: body400, weight: 400, style: "normal" },
      { name: "Instrument Sans", data: body600, weight: 600, style: "normal" },
    ],
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
}
