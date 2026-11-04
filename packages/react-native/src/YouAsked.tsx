import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Animated, Easing, Pressable, View, useColorScheme, type ImageSourcePropType, type StyleProp, type ViewStyle } from "react-native";
import { createClient, type Config, type Notice, type WhatsNew, type YouAskedUser } from "./client";
import { YouAskedContext, registerOpener, useInternal as useInternalStyles, toRoute, type CaptureScreenshot, type InternalContext, type OpenOptions, type Route } from "./context";
import { createDemoClient } from "./demo";
import { IconCheck, IconClose, IconIdea } from "./icons";
import { getAnonId, getItem, haptic, setItem } from "./platform";
import { Sheet, useInsets } from "./Sheet";
import { makeStyles } from "./styles";
import { resolveTheme, type Appearance } from "./theme";
import { Button, T, Tap, useNative, whatsNewHeading } from "./ui";
import { Navigator } from "./views";
import { YouAskedError } from "./client";

export const DEFAULT_API_URL = "https://api.youasked.dev";

export type YouAskedProps = {
  /** Publishable key (ya_pub_…). Safe to ship in your app. Not needed with `demo`. */
  appKey?: string;
  /**
   * Runs entirely on the device with sample requests and a pretend team, no network. Posting, voting,
   * commenting and a reply a few seconds later all work. For Storybook, previews and trying it out.
   */
  demo?: boolean;
  /** Who's asking. Leave out for anonymous visitors. */
  user?: YouAskedUser | null;
  /** hex HMAC-SHA256 of user.id with your secret key, made on your server (see `signUser`). */
  signature?: string | null;
  /** Set false while you're still fetching the signature; the widget waits instead of acting anonymously. */
  ready?: boolean;
  appearance?: Appearance;
  /** "floating" adds a launcher button in the corner. "none" if you use the inline entry points or your own buttons. */
  trigger?: "floating" | "none";
  position?: "bottom-right" | "bottom-left";
  /** Text next to the launcher icon. Leave empty for an icon-only bubble. */
  label?: string;
  /** Your app's name in the greeting. Defaults to the name you created the app with. */
  appName?: string;
  /** Your app's icon: an image URL or a `require("./icon.png")`. Shown in the header and on team replies. */
  appIcon?: string | ImageSourcePropType | false;
  /** First message on the home screen. */
  greeting?: string;
  /** Heading of the full list. */
  title?: string;
  /**
   * Distance in points from the bottom edge for the launcher and cards, above the safe area. Use it to clear
   * a tab bar, e.g. `offset={60}`.
   */
  offset?: number;
  /** Show the card for replies, shipped requests and what's new. */
  cards?: boolean;
  apiUrl?: string;
  /**
   * Lets people attach a screenshot ("Show us"). Return `{ uri }` of an image you captured, for example with
   * react-native-view-shot, or null if they cancel. Leave out and the button doesn't show.
   */
  captureScreenshot?: CaptureScreenshot;
  children?: ReactNode;
};

let warnedTestMode = false;

function coveredBy(news: WhatsNew | null, n: Notice): boolean {
  return n.kind === "shipped" && Boolean(news?.items.some((i) => i.id === n.requestId));
}

export function YouAsked({
  appKey = "",
  demo = false,
  cards = true,
  user,
  signature,
  ready = true,
  appearance,
  trigger = "floating",
  position = "bottom-right",
  label,
  appName,
  appIcon,
  greeting,
  title = "Feature requests",
  offset = 20,
  apiUrl = DEFAULT_API_URL,
  captureScreenshot,
  children,
}: YouAskedProps) {
  const scheme = useColorScheme();
  const appearanceKey = JSON.stringify(appearance ?? {});
  const theme = useMemo(() => resolveTheme(JSON.parse(appearanceKey) as Appearance, scheme), [appearanceKey, scheme]);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const userId = user?.id;
  const userEmail = user?.email;
  const userName = user?.name;
  const client = useMemo(
    () =>
      demo
        ? createDemoClient(appName)
        : createClient({
            appKey,
            apiUrl,
            user: userId == null ? null : { id: userId, email: userEmail, name: userName },
            signature,
            getAnon: getAnonId,
          }),
    [demo, appName, appKey, apiUrl, userId, userEmail, userName, signature],
  );
  const whatsNewKey = demo ? null : `youasked:whats-new:${appKey}:${userId ?? "anon"}`;

  const [route, setRoute] = useState<Route | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [whatsNew, setWhatsNew] = useState<WhatsNew | null>(null);
  const [whatsNewToast, setWhatsNewToast] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const dismissRef = useRef<(() => void) | null>(null);

  const icon = useMemo<ImageSourcePropType | null>(
    () => (!appIcon ? null : typeof appIcon === "string" ? { uri: appIcon } : appIcon),
    [appIcon],
  );

  // Phones keep apps alive for days, so look for replies and "it's live" again whenever the app
  // comes back to the front (at most once a minute).
  const [refresh, setRefresh] = useState(0);
  const lastLoad = useRef(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && Date.now() - lastLoad.current > 60_000) setRefresh((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      try {
        lastLoad.current = Date.now();
        const c = await client.config();
        // Only what shipped after the last time they were shown the list, even if the server missed the news.
        const seenAt = whatsNewKey ? Number(await getItem(whatsNewKey)) || 0 : 0;
        if (!alive) return;
        const items = c.whatsNew?.items.filter((i) => i.shippedAt > seenAt) ?? [];
        const news = c.whatsNew && items.length ? { ...c.whatsNew, items } : null;
        setDisabled(false);
        setConfig(c);
        setWhatsNew(news);
        // A toast on first load, unless a notice that isn't already part of the list is waiting.
        setWhatsNewToast(Boolean(news) && c.unseen.filter((n) => !coveredBy(news, n)).length === 0);
      } catch (err) {
        if (!alive) return;
        if (err instanceof YouAskedError && err.code === "test_mode") {
          setDisabled(true);
          if (!warnedTestMode) {
            warnedTestMode = true;
            console.warn(
              "[YouAsked] This app is in test mode, so feature requests are hidden in this build. Subscribe at https://app.youasked.dev to turn them on.",
            );
          }
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, ready, refresh]);

  // The demo's pretend team writes in a few seconds after you post.
  useEffect(() => {
    if (!("onNotice" in client)) return;
    return (client as ReturnType<typeof createDemoClient>).onNotice((n) =>
      setConfig((c) => (c ? { ...c, unseen: [...c.unseen, n] } : c)),
    );
  }, [client]);

  const dismissWhatsNew = useCallback(() => {
    setWhatsNew(null);
    setWhatsNewToast(false);
    if (whatsNewKey) setItem(whatsNewKey, String(Date.now())).catch(() => {});
    client.whatsNewSeen().catch(() => {});
  }, [client, whatsNewKey]);

  const open = useCallback(
    (options?: OpenOptions) => {
      if (disabled) return;
      setRoute(toRoute(options));
    },
    [disabled],
  );
  const close = useCallback(() => {
    if (dismissRef.current) dismissRef.current();
    else setRoute(null);
  }, []);

  useEffect(() => registerOpener(open), [open]);

  const markSeen = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      setConfig((c) => (c ? { ...c, unseen: c.unseen.filter((n) => !ids.includes(n.id)) } : c));
      client.seen(ids).catch(() => {});
    },
    [client],
  );

  const unseen = config?.unseen ?? [];
  const value = useMemo<InternalContext>(
    () => ({
      open,
      close,
      isOpen: route !== null,
      unseenCount: unseen.length,
      client,
      config,
      markSeen,
      whatsNew,
      dismissWhatsNew,
      theme,
      styles,
      disabled,
      appName: appName ?? config?.app.name ?? "us",
      appIcon: icon,
      title,
      greeting,
      captureScreenshot,
    }),
    [open, close, route, unseen.length, client, config, markSeen, whatsNew, dismissWhatsNew, theme, styles, disabled, appName, icon, title, greeting, captureScreenshot],
  );

  // "It's live" notices for things already in the what's-new list wait for that list instead of saying it twice.
  const standing = unseen.filter((n) => !coveredBy(whatsNew, n));
  const notice = standing.find((n) => n.kind === "shipped") ?? standing.find((n) => n.kind === "reply");

  return (
    <YouAskedContext.Provider value={value}>
      {children}
      {!disabled && (
        <>
          {trigger === "floating" && route === null && (
            <Launcher position={position} label={label} offset={offset} badge={unseen.length > 0} onPress={() => open()} />
          )}
          {cards && !notice && whatsNewToast && whatsNew && route === null && (
            <WhatsNewToast news={whatsNew} position={position} trigger={trigger} offset={offset} onOpen={() => open()} onDismiss={dismissWhatsNew} />
          )}
          {cards && notice && route === null && (
            <ShippedToast
              key={notice.id}
              notice={notice}
              position={position}
              trigger={trigger}
              offset={offset}
              onOpen={() => {
                markSeen([notice.id]);
                open({ requestId: notice.requestId });
              }}
              onDismiss={() => markSeen([notice.id])}
            />
          )}
          <Sheet active={route !== null} onClosed={() => setRoute(null)} dismissRef={dismissRef}>
            {route && <Navigator route={route} setRoute={setRoute} onClose={close} />}
          </Sheet>
        </>
      )}
    </YouAskedContext.Provider>
  );
}

// ---------------------------------------------------------------- launcher and cards

function sideStyle(position: string, offset: number, bottomInset: number, lift: number): StyleProp<ViewStyle> {
  return { bottom: offset + bottomInset + lift, ...(position === "bottom-left" ? { left: 20 } : { right: 20 }) };
}

function Launcher({
  position,
  label,
  offset,
  badge,
  onPress,
}: {
  position: string;
  label?: string;
  offset: number;
  badge: boolean;
  onPress: () => void;
}) {
  const { styles: s, theme } = useInternalStyles();
  const insets = useInsets();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, friction: 6, tension: 120, useNativeDriver: useNative }).start();
  }, [v]);
  return (
    <Animated.View style={[{ position: "absolute", zIndex: 50 }, sideStyle(position, offset, insets.bottom, 0), { opacity: v, transform: [{ scale: v }] }]}>
      <Tap
        onPress={onPress}
        accessibilityLabel={label || "Feature requests"}
        style={[s.fab, label ? s.fabLabel : null]}
      >
        <IconIdea color={theme.accentFg} ink={theme.accent} size={26} />
        {label ? <T style={s.fabText}>{label}</T> : null}
        {badge && <View style={[s.dot, s.dotAbs, { borderColor: theme.accent }]} />}
      </Tap>
    </Animated.View>
  );
}

/** Slides up from the bottom edge when it first shows. */
function useSlideIn() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.bezier(0.34, 1.3, 0.64, 1), useNativeDriver: useNative }).start();
  }, [v]);
  return { opacity: v.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: "clamp" }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] };
}

function toastPlacement(position: string, trigger: string, offset: number, bottomInset: number): StyleProp<ViewStyle> {
  const lift = trigger === "floating" ? 68 : 0;
  return { bottom: offset + bottomInset + lift, ...(position === "bottom-left" ? { alignSelf: "flex-start" } : {}) };
}

function ToastShell({
  kicker,
  onDismiss,
  position,
  trigger,
  offset,
  children,
}: {
  kicker: string;
  onDismiss: () => void;
  position: string;
  trigger: string;
  offset: number;
  children: ReactNode;
}) {
  const { styles: s, theme } = useInternalStyles();
  const insets = useInsets();
  const anim = useSlideIn();
  return (
    <Animated.View accessibilityRole="alert" style={[s.toast, toastPlacement(position, trigger, offset, insets.bottom), anim]}>
      <View style={s.toastTop}>
        <T style={s.kicker}>{kicker}</T>
        <Pressable accessibilityLabel="Dismiss" onPress={onDismiss} hitSlop={10} style={{ margin: -4, padding: 4 }}>
          <IconClose color={theme.muted} size={18} />
        </Pressable>
      </View>
      {children}
    </Animated.View>
  );
}

function ShippedToast({
  notice,
  position,
  trigger,
  offset,
  onOpen,
  onDismiss,
}: {
  notice: Notice;
  position: string;
  trigger: string;
  offset: number;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const { styles: s, theme } = useInternalStyles();
  useEffect(() => {
    haptic.success();
  }, []);
  const reply = notice.kind === "reply";
  return (
    <ToastShell kicker={reply ? "New reply about" : "You asked for"} onDismiss={onDismiss} position={position} trigger={trigger} offset={offset}>
      <T style={s.toastTitle}>{notice.title}</T>
      {reply ? (
        <T style={[s.toastNote, { color: theme.fg }]} numberOfLines={3}>
          {notice.reply}
        </T>
      ) : (
        <>
          <View style={s.live}>
            <IconCheck color={theme.green} size={15} />
            <T style={s.liveText}>It's live</T>
          </View>
          {notice.shipNote ? <T style={s.toastNote}>{notice.shipNote}</T> : null}
        </>
      )}
      <View style={s.toastActions}>
        <Button small label={reply ? "Reply" : "See it"} onPress={onOpen} />
        <Button small ghost label={reply ? "Later" : "Nice"} onPress={onDismiss} />
      </View>
    </ToastShell>
  );
}

function WhatsNewToast({
  news,
  position,
  trigger,
  offset,
  onOpen,
  onDismiss,
}: {
  news: WhatsNew;
  position: string;
  trigger: string;
  offset: number;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const { styles: s, theme } = useInternalStyles();
  const mine = news.items.some((i) => i.mine);
  useEffect(() => {
    if (mine) haptic.success();
  }, [mine]);
  return (
    <ToastShell kicker="What's new" onDismiss={onDismiss} position={position} trigger={trigger} offset={offset}>
      <T style={s.toastTitle}>{whatsNewHeading(news.total)}</T>
      {mine && (
        <View style={s.live}>
          <IconCheck color={theme.green} size={15} />
          <T style={s.liveText}>Including something you asked for</T>
        </View>
      )}
      <View style={s.toastActions}>
        <Button small label="See what's new" onPress={onOpen} />
        <Button small ghost label="Not now" onPress={onDismiss} />
      </View>
    </ToastShell>
  );
}
