// A pretend backend for <YouAsked demo />: sample requests in memory, a little fake latency, and a
// "team" that answers a few seconds after you post or comment. Nothing leaves the page.
import {
  YouAskedError,
  type Attachment,
  type Client,
  type Config,
  type FeatureRequest,
  type Notice,
  type RequestComment,
  type RequestDetail,
  type Status,
} from "./client";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

type Stored = FeatureRequest & { comments_: RequestComment[]; attachments_: Attachment[]; early: boolean };

const uploads = new Map<string, Attachment>();

const wait = (ms = 380) => new Promise<void>((r) => setTimeout(r, ms + Math.random() * ms * 0.5));

const WORDS = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));

export type DemoClient = Client & {
  /** Calls back when the pretend team writes in. Returns an unsubscribe. */
  onNotice: (fn: (n: Notice) => void) => () => void;
};

export function createDemoClient(appName = "this app"): DemoClient {
  const t0 = Date.now();
  let seq = 100;
  const listeners = new Set<(n: Notice) => void>();
  const answered = new Set<string>();

  const seed = (
    n: number,
    title: string,
    body: string,
    votes: number,
    status: Status,
    extra: Partial<Stored> = {},
  ): Stored => ({
    id: `demo_${n}`,
    number: n,
    title,
    body,
    status,
    votes,
    comments: extra.comments_?.length ?? 0,
    shipNote: null,
    shippedAt: null,
    context: null,
    creditName: null,
    createdAt: t0 - (20 - n) * DAY,
    voted: false,
    mine: false,
    comments_: [],
    attachments_: [],
    early: false,
    ...extra,
  });

  const team = (id: string, body: string, ago: number): RequestComment => ({ id, body, team: true, author: null, mine: false, createdAt: t0 - ago });

  const store: Stored[] = [
    seed(12, "Dark mode", "Easier on the eyes at night, and it'd match the rest of my phone.", 14, "planned", {
      comments_: [
        { id: "c1", body: "Yes please. I use it every night.", team: false, author: "Raj", mine: false, createdAt: t0 - 3 * DAY },
        team("c2", "On the list for December. Would following your phone's setting be enough to start?", 2 * DAY),
      ],
    }),
    seed(13, "Export to CSV", "So I can open everything in a spreadsheet.", 11, "in_progress"),
    seed(7, "Keyboard shortcuts", "", 8, "shipped", {
      shipNote: "Press ? anywhere to see them all.",
      shippedAt: t0 - 2 * DAY,
      creditName: "Sam",
    }),
    seed(14, "Offline mode", "I use it on the train and keep losing signal.", 6, "open"),
    seed(15, "Share a link with a friend", "", 4, "open"),
    seed(16, "Widget for the home screen", "Just today's number would be enough.", 3, "open"),
    seed(9, "Sign in with Apple", "", 5, "shipped", {
      shipNote: "You can now sign in with your Apple ID.",
      shippedAt: t0 - 4 * 60 * MIN,
      mine: true,
      voted: true,
    }),
    seed(17, "A reminder the day before", "A nudge the day before something is due would do.", 2, "open", {
      mine: true,
      voted: true,
      comments_: [team("c3", "Good one. Would a push notification work, or would you rather get an email?", 3 * 60 * MIN)],
    }),
  ];


  const find = (id: string) => store.find((r) => r.id === id);
  const view = (r: Stored): FeatureRequest => {
    const { comments_, attachments_, early, ...rest } = r;
    void comments_, attachments_, early;
    return { ...rest, comments: r.comments_.length };
  };
  const notify = (n: Notice) => listeners.forEach((fn) => fn(n));

  const teamReplies = [
    "Thanks, this is useful. We've added it to the board. Roughly how often would you use it?",
    "Love this one. Can you tell us what you do today instead?",
    "Noted! The more votes it gets, the sooner it moves up.",
  ];
  const scheduleReply = (r: Stored, delay: number) => {
    if (answered.has(r.id)) return;
    answered.add(r.id);
    setTimeout(() => {
      const c = team(`demo_c${++seq}`, teamReplies[seq % teamReplies.length], 0);
      c.createdAt = Date.now();
      r.comments_.push(c);
      notify({ id: `demo_n${++seq}`, kind: "reply", requestId: r.id, title: r.title, shipNote: null, reply: c.body });
    }, delay);
  };

  const shippedMine = store.filter((r) => r.status === "shipped");
  const config: Config = {
    app: { name: appName },
    watermark: false,
    identified: true,
    canCredit: true,
    unseen: [],
    whatsNew: {
      total: shippedMine.length,
      items: [...shippedMine]
        .sort((a, b) => Number(b.mine) - Number(a.mine) || (b.shippedAt ?? 0) - (a.shippedAt ?? 0))
        .map((r) => ({ id: r.id, title: r.title, shipNote: r.shipNote, shippedAt: r.shippedAt ?? t0, mine: r.mine })),
    },
  };

  return {
    onNotice(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async config() {
      await wait(200);
      return config;
    },
    async list(sort, status) {
      await wait();
      const active: Status[] = ["open", "planned", "in_progress"];
      const rows = store.filter((r) => (status === "all" ? true : status === "shipped" ? r.status === "shipped" : active.includes(r.status)));
      rows.sort((a, b) =>
        status === "shipped" ? (b.shippedAt ?? 0) - (a.shippedAt ?? 0) : sort === "new" ? b.createdAt - a.createdAt : b.votes - a.votes || b.createdAt - a.createdAt,
      );
      return rows.map(view);
    },
    async similar(q) {
      await wait(250);
      const words = WORDS(q);
      if (!words.size) return [];
      return store
        .filter((r) => r.status !== "declined")
        .map((r) => ({ r, hits: [...WORDS(r.title)].filter((w) => words.has(w)).length }))
        .filter((x) => x.hits >= 2 || (x.hits === 1 && WORDS(x.r.title).size <= 2))
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 3)
        .map((x) => view(x.r));
    },
    async get(id): Promise<RequestDetail> {
      await wait();
      const r = find(id);
      if (!r) throw new YouAskedError("not_found");
      const othersJoined = r.votes > (r.mine && r.voted ? 1 : 0) || r.comments_.some((c) => !c.mine);
      return {
        request: view(r),
        comments: [...r.comments_],
        attachments: [...r.attachments_],
        earlyAccess: r.early,
        canDelete: Boolean(r.mine) && (r.status === "open" || r.status === "pending") && !othersJoined,
      };
    },
    async remove(id) {
      await wait();
      const i = store.findIndex((r) => r.id === id);
      if (i >= 0) store.splice(i, 1);
      return { ok: true as const };
    },
    async create(input) {
      await wait(650);
      const r: Stored = {
        id: `demo_${++seq}`,
        number: 20 + store.length,
        title: input.title,
        body: input.body === input.title ? "" : input.body,
        status: "open",
        votes: 1,
        comments: 0,
        shipNote: null,
        shippedAt: null,
        context: input.context ?? null,
        creditName: null,
        createdAt: Date.now(),
        voted: true,
        mine: true,
        comments_: [],
        attachments_: (input.attachments ?? []).map((id) => uploads.get(id)!).filter(Boolean),
        early: false,
      };
      store.unshift(r);
      scheduleReply(r, 5200);
      return { ...view(r), attachments: r.attachments_ };
    },
    async upload(image) {
      await wait(300);
      const id = `demo_up${++seq}`;
      const a = { id, url: URL.createObjectURL(image) };
      uploads.set(id, a);
      return a;
    },
    async vote(id) {
      await wait(180);
      const r = find(id)!;
      r.voted = !r.voted;
      r.votes += r.voted ? 1 : -1;
      return { voted: r.voted, votes: r.votes };
    },
    async comment(id, body) {
      await wait(300);
      const r = find(id)!;
      const c: RequestComment = { id: `demo_c${++seq}`, body, team: false, author: "You", mine: true, createdAt: Date.now() };
      r.comments_.push(c);
      if (r.mine) scheduleReply(r, 3800);
      return c;
    },
    async earlyAccess(id) {
      await wait(200);
      const r = find(id)!;
      r.early = !r.early;
      return { earlyAccess: r.early };
    },
    async mine() {
      await wait();
      return store.filter((r) => r.mine || r.voted).map(view);
    },
    async seen() {
      return { ok: true as const };
    },
    async whatsNewSeen() {
      return { ok: true as const };
    },
  };
}

