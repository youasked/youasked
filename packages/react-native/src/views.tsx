import { useEffect, useRef, useState } from "react";
import { Animated, Easing, FlatList, Image, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { YouAskedError, type FeatureRequest, type Notice, type RequestComment } from "./client";
import { useInternal, type Route } from "./context";
import { IconChevron, IconClose, IconFrame, IconPlus, IconSend, IconSpark } from "./icons";
import { haptic } from "./platform";
import {
  AppAvatar,
  BigVote,
  Button,
  Empty,
  FadeIn,
  GreenDot,
  Header,
  LinkButton,
  RequestRow,
  Section,
  Skeleton,
  StatusPill,
  T,
  Tap,
  Toggle,
  ago,
  errorText,
  useLoad,
  useNative,
  whatsNewHeading,
} from "./ui";

type NavProps = { route: Route; setRoute: (r: Route) => void; onClose?: () => void };

/** Renders the current screen. Shared by the sheet and the embedded board. */
export function Navigator({ route, setRoute, onClose }: NavProps) {
  const key = route.view === "home" ? `home${route.draft ?? ""}${route.focus ? "f" : ""}${route.topic ?? ""}` : route.view === "detail" ? `d${route.id}` : route.view;
  return (
    <FadeIn key={key}>
      {route.view === "home" ? (
        <Home route={route} setRoute={setRoute} onClose={onClose} />
      ) : route.view === "board" ? (
        <Board initialTab={route.tab} setRoute={setRoute} onClose={onClose} />
      ) : route.view === "detail" ? (
        <Detail id={route.id} setRoute={setRoute} onClose={onClose} />
      ) : (
        <Mine setRoute={setRoute} onClose={onClose} />
      )}
    </FadeIn>
  );
}

// ---------------------------------------------------------------- home: a chat-style start screen

type ThreadItem =
  | { kind: "out"; text: string; images?: string[] }
  | { kind: "typing" }
  | { kind: "posted"; request: FeatureRequest }
  | { kind: "reply"; notice: Notice }
  | { kind: "error"; text: string };

/** Long messages keep their first line or sentence as the title and the full text as details. */
function splitMessage(text: string): { title: string; body: string } {
  const t = text.trim();
  if (t.length <= 120 && !t.includes("\n")) return { title: t, body: "" };
  const first = t.split("\n")[0];
  const sentence = first.match(/^(.{12,120}?[.!?])\s/)?.[1];
  const title = (sentence ?? first).slice(0, 120).trim();
  return { title, body: t };
}

function Bubble({ children, tone = "in", style }: { children: React.ReactNode; tone?: "in" | "out" | "win" | "error"; style?: object }) {
  const { styles: s } = useInternal();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, friction: 7, tension: 140, useNativeDriver: useNative }).start();
  }, [v]);
  return (
    <Animated.View
      style={[
        s.bubble,
        tone === "out" ? s.bubbleOut : s.bubbleIn,
        tone === "win" && s.bubbleWin,
        tone === "error" && s.bubbleError,
        style,
        { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function ReplyBubble({ notice, appName, onOpen }: { notice: Notice; appName: string; onOpen: () => void }) {
  const { styles: s } = useInternal();
  return (
    <Bubble>
      <T style={s.kicker}>
        {appName} replied about {notice.title}
      </T>
      <T style={s.bubbleText}>{notice.reply}</T>
      <Tap onPress={onOpen}>
        <T style={s.bubbleLink}>Reply</T>
      </Tap>
    </Bubble>
  );
}

/** A short burst from the corner of a bubble when something they asked for has shipped. */
function Confetti() {
  const { theme } = useInternal();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(p, { toValue: 1, duration: 950, easing: Easing.out(Easing.cubic), useNativeDriver: useNative }).start();
  }, [p]);
  const colors = [theme.accent, theme.green, theme.amber, "#ff7eb3"];
  return (
    <View style={{ position: "absolute", top: 14, right: 18, width: 0, height: 0, zIndex: 2 }}>
      {Array.from({ length: 14 }, (_, i) => {
        const angle = (Math.PI * (0.15 + (i / 13) * 0.7)) % Math.PI;
        const dist = 38 + (i % 4) * 14;
        const x = Math.round(Math.cos(angle) * dist * (i % 2 ? -1 : 1));
        const y = Math.round(-Math.sin(angle) * dist);
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: -3,
              top: -3,
              width: 6,
              height: 9,
              borderRadius: 2,
              backgroundColor: colors[i % colors.length],
              opacity: p.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
                { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, y + 24] }) },
                { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${(i * 67) % 360}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

function Typing() {
  const { styles: s } = useInternal();
  const v = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const loops = v.map((x, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(x, { toValue: 1, duration: 350, useNativeDriver: useNative }),
          Animated.timing(x, { toValue: 0.3, duration: 350, useNativeDriver: useNative }),
          Animated.delay(300 - i * 150),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [v]);
  return (
    <Bubble style={s.typing}>
      {v.map((x, i) => (
        <Animated.View key={i} style={[s.typingDot, { opacity: x }]} />
      ))}
    </Bubble>
  );
}

type Shot = { uri: string };
const MAX_SHOTS = 3;

function Home({ route, setRoute, onClose }: NavProps & { route: Extract<Route, { view: "home" }> }) {
  const { client, config, appName, appIcon, greeting, markSeen, whatsNew, dismissWhatsNew, captureScreenshot, styles: s, theme } = useInternal();
  const top = useLoad(() => client.list("top", "active"), [client]);
  const shipped = useLoad(() => client.list("new", "shipped"), [client]);
  const [text, setText] = useState(route.draft ?? "");
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [similar, setSimilar] = useState<FeatureRequest[]>([]);
  const [notices] = useState<Notice[]>(() => config?.unseen ?? []);
  // What shipped since the last visit is shown once: read it now, then tell the server it's been seen.
  const [news] = useState(() => whatsNew);
  const [shots, setShots] = useState<Shot[]>([]);
  const [shotError, setShotError] = useState<string | null>(null);
  const [credit, setCredit] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inputH, setInputH] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const sending = thread.some((t) => t.kind === "typing");

  useEffect(() => {
    if (notices.length) markSeen(notices.map((n) => n.id));
  }, [notices, markSeen]);

  useEffect(() => {
    if (news) dismissWhatsNew();
    if (news?.items.some((i) => i.mine)) haptic.success();
  }, [news, dismissWhatsNew]);

  // The team answering while this screen is open (the demo does this a few seconds after you post).
  const arrived = config?.unseen.filter((n) => n.kind === "reply" && !notices.some((o) => o.id === n.id)) ?? [];
  const arrivedKey = arrived.map((n) => n.id).join(",");
  useEffect(() => {
    if (!arrived.length) return;
    setThread((th) => [...th, ...arrived.map((notice) => ({ kind: "reply" as const, notice }))]);
    markSeen(arrived.map((n) => n.id));
    haptic.success();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivedKey]);

  useEffect(() => {
    if (!route.focus) return;
    // Wait for the sheet to finish sliding up, or the keyboard fights the animation.
    const t = setTimeout(() => inputRef.current?.focus(), 380);
    return () => clearTimeout(t);
  }, [route.focus]);

  useEffect(() => {
    if (thread.length) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [thread]);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 4) {
      setSimilar([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      client
        .similar(q)
        .then((r) => alive && setSimilar(r.slice(0, 3)))
        .catch(() => {});
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [client, text]);

  const addShot = async () => {
    setShotError(null);
    try {
      const shot = await captureScreenshot?.();
      if (shot) setShots((all) => [...all, { uri: shot.uri }]);
    } catch {
      setShotError("Couldn't capture the screen. You can still describe it in words.");
    }
  };

  const send = async () => {
    const message = text.trim();
    if (message.length < 3 || sending) return;
    const attached = shots;
    const credited = credit && Boolean(config?.canCredit);
    setText("");
    setInputH(0);
    setSimilar([]);
    setShots([]);
    setShotError(null);
    setCredit(false);
    haptic.light();
    setThread((th) => [...th, { kind: "out", text: message, images: attached.map((x) => x.uri) }, { kind: "typing" }]);
    const { title, body } = splitMessage(message);
    try {
      const attachments = await Promise.all(
        attached.map(async (x) => client.upload(await (await fetch(x.uri)).blob()).then((a) => a.id)),
      );
      const [request] = await Promise.all([
        client.create({ title, body, attachments, context: route.topic ? { topic: route.topic } : undefined, credit: credited }),
        new Promise<void>((r) => setTimeout(r, 650)),
      ]);
      setThread((th) => [...th.filter((t) => t.kind !== "typing"), { kind: "posted", request }]);
      haptic.success();
    } catch (err) {
      setThread((th) => [
        ...th.filter((t) => t.kind !== "typing" && !(t.kind === "out" && t.text === message)),
        { kind: "error", text: errorText(err instanceof YouAskedError ? err.code : "network") },
      ]);
      setText(message);
      setShots(attached);
      setCredit(credited);
    }
  };

  const chatting = thread.length > 0;
  const openRequest = (id: string) => setRoute({ view: "detail", id });
  const asking = route.topic && route.placeholder ? route.topic : null;
  const placeholder = route.placeholder ?? "Ask for a feature…";
  const yours = news?.items.find((i) => i.mine);
  // Shipped notices for things already listed in the "what's new" bubble would just say it twice.
  const listed = new Set(news?.items.map((i) => i.id));
  const shownNotices = notices.filter((n) => !(n.kind === "shipped" && listed.has(n.requestId)));
  const canSend = text.trim().length >= 3 && !sending;

  return (
    <>
      <Header
        leading={<AppAvatar icon={appIcon} />}
        title={appName}
        subtitle="Ideas, votes and what's new"
        onClose={onClose}
      />
      <ScrollView
        ref={scrollRef}
        style={s.body}
        contentContainerStyle={[s.bodyContent, s.chat]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={useNative ? "interactive" : "none"}
        showsVerticalScrollIndicator={false}
      >
        <Bubble>
          <T style={s.bubbleText}>
            {asking ? `Let's talk about ${asking}. What's missing, or what bugs you?` : (greeting ?? `Hey! What would make ${appName} better for you?`)}
          </T>
        </Bubble>
        {news && (
          <Bubble tone={yours ? "win" : "in"} style={s.bubbleNews}>
            {yours && <Confetti />}
            <T style={s.kicker}>{whatsNewHeading(news.total)}</T>
            <View style={{ width: "100%" }}>
              {news.items.map((i, idx) => (
                <Tap
                  key={i.id}
                  scale={false}
                  onPress={() => openRequest(i.id)}
                  style={[s.newsItem, idx === 0 && { borderTopWidth: 0 }]}
                >
                  <GreenDot />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T style={s.newsTitle}>{i.title}</T>
                    {i.mine && <T style={s.newsYou}>You asked for this</T>}
                  </View>
                  <IconChevron color={theme.muted} size={16} />
                </Tap>
              ))}
            </View>
            {yours && <T style={s.bubbleText}>That one was yours. Thanks for asking.</T>}
            {news.total > news.items.length && (
              <Tap onPress={() => setRoute({ view: "board", tab: "shipped" })}>
                <T style={s.bubbleLink}>See all {news.total}</T>
              </Tap>
            )}
          </Bubble>
        )}
        {shownNotices.map((n) =>
          n.kind === "reply" ? (
            <ReplyBubble key={n.id} notice={n} appName={appName} onOpen={() => openRequest(n.requestId)} />
          ) : (
            <Bubble key={n.id} tone="win">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <GreenDot size={18} />
                <T style={s.liveText}>It's live</T>
              </View>
              <T style={s.bubbleText}>
                You asked for <T style={s.bold}>{n.title}</T>. {n.shipNote ?? "Thanks for asking."}
              </T>
              <Tap onPress={() => openRequest(n.requestId)}>
                <T style={s.bubbleLink}>See it</T>
              </Tap>
            </Bubble>
          ),
        )}

        {!chatting && (
          <>
            <Section title="Popular right now" action="See all" onAction={() => setRoute({ view: "board" })}>
              {top.error ? (
                <T style={s.note}>{errorText(top.error)}</T>
              ) : !top.data ? (
                <Skeleton rows={2} />
              ) : top.data.length === 0 ? (
                <T style={s.note}>No requests yet. Yours could be the first.</T>
              ) : (
                <View style={s.list}>
                  {top.data.slice(0, 3).map((r) => (
                    <RequestRow key={r.id} client={client} request={r} compact onOpen={() => openRequest(r.id)} />
                  ))}
                </View>
              )}
            </Section>
            {shipped.data && shipped.data.length > 0 && (
              <Section title="Recently shipped" action="All" onAction={() => setRoute({ view: "board", tab: "shipped" })}>
                <View>
                  {shipped.data.slice(0, 3).map((r, i, arr) => (
                    <Tap
                      key={r.id}
                      scale={false}
                      onPress={() => openRequest(r.id)}
                      style={[s.shippedRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}
                    >
                      <GreenDot />
                      <T style={s.shippedTitle} numberOfLines={1}>
                        {r.title}
                      </T>
                      <T style={s.shippedWhen}>{r.shippedAt ? ago(r.shippedAt) : ""}</T>
                    </Tap>
                  ))}
                </View>
              </Section>
            )}
          </>
        )}

        {thread.map((t, i) =>
          t.kind === "out" ? (
            <Bubble key={i} tone="out">
              {t.images?.map((uri) => (
                <Image key={uri} source={{ uri }} style={{ width: 200, height: 120, borderRadius: 12 }} accessibilityLabel="Your screenshot" />
              ))}
              <T style={[s.bubbleText, s.bubbleTextOut]}>{t.text}</T>
            </Bubble>
          ) : t.kind === "typing" ? (
            <Typing key={i} />
          ) : t.kind === "reply" ? (
            <ReplyBubble key={i} notice={t.notice} appName={appName} onOpen={() => openRequest(t.notice.requestId)} />
          ) : t.kind === "posted" ? (
            <Bubble key={i}>
              <T style={s.bubbleText}>
                Got it. <T style={s.bold}>{t.request.title}</T> is on the board, and we'll tell you right here when it ships.
              </T>
              <Tap onPress={() => openRequest(t.request.id)}>
                <T style={s.bubbleLink}>View request</T>
              </Tap>
            </Bubble>
          ) : (
            <Bubble key={i} tone="error">
              <T style={s.bubbleText} accessibilityRole="alert">
                {t.text}
              </T>
            </Bubble>
          ),
        )}
        {chatting && !sending && (
          <Tap onPress={() => setRoute({ view: "board" })} style={s.chip}>
            <T style={s.chipText}>See what others asked for</T>
          </Tap>
        )}
      </ScrollView>

      <View style={s.composerWrap}>
        {similar.length > 0 && (
          <View style={s.tray}>
            <T style={s.trayH}>Sounds like one of these. Vote instead?</T>
            <View style={s.list}>
              {similar.map((r) => (
                <RequestRow key={r.id} client={client} request={r} compact onTint onOpen={() => openRequest(r.id)} />
              ))}
            </View>
          </View>
        )}
        {shots.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {shots.map((x, i) => (
              <View key={x.uri} style={s.shot}>
                <Image source={{ uri: x.uri }} style={s.shotImg} />
                <T style={{ fontSize: 13, fontWeight: "600" }}>Screenshot{shots.length > 1 ? ` ${i + 1}` : ""}</T>
                <Tap
                  accessibilityLabel="Remove screenshot"
                  onPress={() => setShots((all) => all.filter((y) => y !== x))}
                  style={[s.iconBtn, s.iconBtnPlain, { width: 24, height: 24 }]}
                >
                  <IconClose color={theme.muted} size={13} />
                </Tap>
              </View>
            ))}
          </View>
        )}
        <View style={[s.composer, focused && s.composerFocus]}>
          <TextInput
            ref={inputRef}
            style={[s.input, { height: Math.max(40, Math.min(inputH, 132)) }, theme.fontFamily ? { fontFamily: theme.fontFamily } : null]}
            multiline
            value={text}
            onChangeText={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onContentSizeChange={(e) => setInputH(e.nativeEvent.contentSize.height)}
            placeholder={placeholder}
            placeholderTextColor={theme.muted}
            accessibilityLabel={asking ? placeholder : "Ask for a feature"}
            maxLength={2000}
            textAlignVertical="center"
            selectionColor={theme.accent}
            keyboardAppearance={theme.mode}
          />
          <Tap onPress={send} disabled={!canSend} accessibilityLabel="Send" style={[s.send, !canSend && s.sendOff]}>
            <IconSend color={theme.accentFg} />
          </Tap>
        </View>
        {(captureScreenshot || (config?.canCredit && text.trim().length > 0)) && (
          <View style={s.tools}>
            {captureScreenshot ? (
              <Tap onPress={addShot} disabled={sending || shots.length >= MAX_SHOTS} style={s.tool}>
                <IconFrame color={theme.accent} size={16} />
                <T style={s.toolText}>Show us</T>
              </Tap>
            ) : (
              <View />
            )}
            {config?.canCredit && text.trim().length > 0 && (
              <Tap
                accessibilityRole="switch"
                accessibilityState={{ checked: credit }}
                onPress={() => setCredit((c) => !c)}
                scale={false}
                style={s.switchRow}
              >
                <T style={[s.switchLabel, credit && s.switchLabelOn]}>Credit me when it ships</T>
                <Toggle on={credit} />
              </Tap>
            )}
          </View>
        )}
        {shotError && (
          <T style={s.note} accessibilityRole="alert">
            {shotError}
          </T>
        )}
        {config?.watermark && <T style={s.mark}>Feedback by YouAsked</T>}
      </View>
    </>
  );
}

// ---------------------------------------------------------------- full board

const TABS = [
  { key: "top", label: "Top", sort: "top", status: "active" },
  { key: "new", label: "New", sort: "new", status: "active" },
  { key: "shipped", label: "Shipped", sort: "new", status: "shipped" },
] as const;

function Board({
  initialTab,
  setRoute,
  onClose,
}: {
  initialTab?: "top" | "new" | "shipped";
  setRoute: (r: Route) => void;
  onClose?: () => void;
}) {
  const { client, title, styles: s, theme } = useInternal();
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS.find((t) => t.key === initialTab) ?? TABS[0]);
  const { data, error, refresh, refreshing } = useLoad(() => client.list(tab.sort, tab.status), [client, tab.key]);

  return (
    <>
      <Header
        title={title}
        onBack={() => setRoute({ view: "home" })}
        onClose={onClose}
        right={<LinkButton label="Yours" onPress={() => setRoute({ view: "mine" })} />}
      />
      <View style={s.tabs} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Tap
            key={t.key}
            scale={false}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab.key === t.key }}
            onPress={() => setTab(t)}
            style={[s.tab, tab.key === t.key && s.tabOn]}
          >
            <T style={[s.tabText, tab.key === t.key && s.tabTextOn]}>{t.label}</T>
          </Tap>
        ))}
      </View>
      {error ? (
        <Empty title="Couldn't load requests">{errorText(error)}</Empty>
      ) : !data ? (
        <View style={s.bodyContent}>
          <Skeleton />
        </View>
      ) : (
        <FlatList
          style={s.body}
          contentContainerStyle={[s.bodyContent, s.list, data.length === 0 && { flexGrow: 1 }]}
          data={data}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <RequestRow client={client} request={item} onOpen={() => setRoute({ view: "detail", id: item.id })} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.muted} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Empty title={tab.key === "shipped" ? "Nothing shipped yet" : "No requests yet"}>
              {tab.key === "shipped" ? "Requests show up here once they're live." : "Tell us what you'd like next. Others can vote on it."}
            </Empty>
          }
        />
      )}
      <View style={s.foot}>
        <Button label="Request a feature" icon={<IconPlus color={theme.accentFg} />} onPress={() => setRoute({ view: "home", focus: true })} />
      </View>
    </>
  );
}

// ---------------------------------------------------------------- one request

function Detail({ id, setRoute, onClose }: { id: string; setRoute: (r: Route) => void; onClose?: () => void }) {
  const { client, config, markSeen, appName, appIcon, styles: s, theme } = useInternal();
  const { data, error, setData } = useLoad(() => client.get(id), [client, id]);

  // Opening a request someone was told about counts as seeing it.
  const unseenHere = config?.unseen.filter((n) => n.requestId === id).map((n) => n.id).join(",") ?? "";
  const loaded = useRef(false);
  loaded.current = Boolean(data);
  useEffect(() => {
    if (!unseenHere) return;
    markSeen(unseenHere.split(","));
    // A reply that lands while you're reading shows up in the thread.
    if (loaded.current) {
      client
        .get(id)
        .then((d) => setData(d))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unseenHere, markSeen]);
  const [reply, setReply] = useState("");
  const [replyH, setReplyH] = useState(0);
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [voted, setVoted] = useState<boolean | null>(null);
  const [early, setEarly] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => setEarly(Boolean(data?.earlyAccess)), [data?.earlyAccess]);

  const toggleEarly = async () => {
    if (!data?.request) return;
    const before = early;
    haptic.light();
    setEarly(!before);
    try {
      setEarly((await client.earlyAccess(data.request.id)).earlyAccess);
    } catch {
      setEarly(before);
    }
  };

  useEffect(() => {
    if (data?.redirect) setRoute({ view: "detail", id: data.redirect });
  }, [data?.redirect, setRoute]);

  const request = data?.request;
  const comments = data?.comments ?? [];

  const send = async () => {
    if (!reply.trim() || sending || !request) return;
    setSending(true);
    setReplyError(null);
    try {
      const c = await client.comment(request.id, reply.trim());
      setData({ ...data, comments: [...comments, c], request: { ...request, comments: request.comments + 1 } });
      setReply("");
      setReplyH(0);
      haptic.light();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (err) {
      setReplyError(errorText(err instanceof YouAskedError ? err.code : "network"));
    } finally {
      setSending(false);
    }
  };

  const canSend = reply.trim().length > 0 && !sending;

  return (
    <>
      <Header title="" onBack={() => setRoute({ view: "board" })} onClose={onClose} />
      <ScrollView
        ref={scrollRef}
        style={s.body}
        contentContainerStyle={s.bodyContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={useNative ? "interactive" : "none"}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <Empty title={error === "not_found" ? "This request was removed." : "Couldn't load this request"}>
            {error === "not_found" ? undefined : errorText(error)}
          </Empty>
        ) : !request ? (
          <Skeleton />
        ) : (
          <>
            <View style={s.detailMeta}>
              {request.status !== "open" && <StatusPill status={request.status} />}
              <T style={s.ref}>YA-{request.number}</T>
            </View>
            <T style={s.detailTitle} accessibilityRole="header">
              {request.title}
            </T>
            {request.body && request.body !== request.title ? <T style={s.text}>{request.body}</T> : null}
            {data?.attachments?.map((a) => (
              <Image
                key={a.id}
                source={{ uri: a.url }}
                resizeMode="cover"
                style={{ width: "100%", height: 200, borderRadius: theme.radius, marginTop: 12, backgroundColor: theme.surface }}
                accessibilityLabel="Screenshot attached to this request"
              />
            ))}
            <BigVote client={client} request={request} onChange={setVoted} />
            {(request.status === "planned" || request.status === "in_progress") && (voted ?? request.voted) && (
              <Tap
                accessibilityRole="switch"
                accessibilityState={{ checked: early }}
                onPress={toggleEarly}
                scale={false}
                style={s.early}
              >
                <View style={[s.cardIcon, { width: 32, height: 32 }, early && s.cardIconOn]}>
                  <IconSpark color={early ? theme.accentFg : theme.accent} size={17} />
                </View>
                <View style={s.menuText}>
                  <T style={s.menuLabel}>Try it early</T>
                  <T style={s.menuSub}>{early ? "You're on the list. We'll let you in first." : "Get access before everyone else"}</T>
                </View>
                <Toggle on={early} />
              </Tap>
            )}
            {request.mine && request.status !== "shipped" && (
              <T style={s.note}>You asked for this. We'll tell you here when it ships.</T>
            )}
            {request.status === "shipped" && (
              <View style={s.callout}>
                <GreenDot size={20} />
                <T style={s.calloutText}>
                  <T style={s.bold}>It's live.</T>
                  {request.shipNote ? ` ${request.shipNote}` : " Thanks for asking."}
                  {request.creditName ? `\nThanks to ${request.creditName} for asking.` : ""}
                </T>
              </View>
            )}
            <T style={s.sectionH}>Conversation</T>
            {comments.length === 0 ? (
              <T style={[s.text, s.textMuted]}>No messages yet. Add details or ask a question below.</T>
            ) : (
              <View style={s.thread}>
                {comments.map((c) => (
                  <Message key={c.id} comment={c} appName={appName} appIcon={appIcon} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
      {request && (
        <View style={s.composerBar}>
          <View style={[s.composer, focused && s.composerFocus]}>
            <TextInput
              style={[s.input, { height: Math.max(40, Math.min(replyH, 132)) }, theme.fontFamily ? { fontFamily: theme.fontFamily } : null]}
              multiline
              value={reply}
              onChangeText={setReply}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onContentSizeChange={(e) => setReplyH(e.nativeEvent.contentSize.height)}
              placeholder="Message"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Message"
              maxLength={1000}
              textAlignVertical="center"
              selectionColor={theme.accent}
              keyboardAppearance={theme.mode}
            />
            <Tap onPress={send} disabled={!canSend} accessibilityLabel="Send comment" style={[s.send, !canSend && s.sendOff]}>
              <IconSend color={theme.accentFg} />
            </Tap>
          </View>
          {replyError && <T style={s.note} accessibilityRole="alert">{replyError}</T>}
        </View>
      )}
    </>
  );
}

/** Team replies read as messages from the app, yours sit on the right like any chat. */
function Message({ comment, appName, appIcon }: { comment: RequestComment; appName: string; appIcon: ReturnType<typeof useInternal>["appIcon"] }) {
  const { styles: s } = useInternal();
  const when = <T style={s.msgMetaText}>{ago(comment.createdAt)}</T>;
  if (comment.mine) {
    return (
      <View style={s.msgOut}>
        <View style={[s.bubble, s.bubbleOut, { maxWidth: "100%" }]}>
          <T style={[s.bubbleText, s.bubbleTextOut]}>{comment.body}</T>
        </View>
        <View style={s.msgMeta}>{when}</View>
      </View>
    );
  }
  return (
    <View style={s.msg}>
      {comment.team && appIcon ? <AppAvatar icon={appIcon} size={26} round /> : null}
      <View style={s.msgBody}>
        <View style={s.msgMeta}>
          <T style={s.msgWho}>{comment.team ? appName : comment.author || "Someone"}</T>
          {comment.team && (
            <View style={s.teamTag}>
              <T style={s.teamTagText}>Team</T>
            </View>
          )}
          {when}
        </View>
        <View style={[s.bubble, s.bubbleIn, { maxWidth: "100%" }]}>
          <T style={s.bubbleText}>{comment.body}</T>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- yours

function Mine({ setRoute, onClose }: { setRoute: (r: Route) => void; onClose?: () => void }) {
  const { client, styles: s, theme } = useInternal();
  const { data, error, refresh, refreshing } = useLoad(() => client.mine(), [client]);
  return (
    <>
      <Header title="Your requests" onBack={() => setRoute({ view: "board" })} onClose={onClose} />
      {error ? (
        <Empty title="Couldn't load your requests">{errorText(error)}</Empty>
      ) : !data ? (
        <View style={s.bodyContent}>
          <Skeleton />
        </View>
      ) : (
        <FlatList
          style={s.body}
          contentContainerStyle={[s.bodyContent, s.list, data.length === 0 && { flexGrow: 1 }]}
          data={data}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <RequestRow client={client} request={item} onOpen={() => setRoute({ view: "detail", id: item.id })} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.muted} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Empty title="Nothing yet">Requests you post or vote on show up here, with their status.</Empty>}
        />
      )}
      <View style={s.foot}>
        <Button label="Request a feature" icon={<IconPlus color={theme.accentFg} />} onPress={() => setRoute({ view: "home", focus: true })} />
      </View>
    </>
  );
}
