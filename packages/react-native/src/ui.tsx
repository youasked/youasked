import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { YouAskedError, type Client, type FeatureRequest, type Status } from "./client";
import { DragContext, useInternal } from "./context";
import { IconBack, IconChat, IconCheck, IconChevron, IconClose, IconUp } from "./icons";
import { haptic } from "./platform";

export const useNative = Platform.OS !== "web";

/** Text in the app's font and colour. Caps system font scaling so the layout holds. */
export function T({ style, ...props }: TextProps) {
  const { theme } = useInternal();
  return <Text maxFontSizeMultiplier={1.3} {...props} style={[{ color: theme.fg, fontFamily: theme.fontFamily }, style]} />;
}

/** A pressable that dims slightly while held, the way native buttons do. */
export function Tap({
  style,
  children,
  scale = true,
  ...props
}: React.ComponentProps<typeof Pressable> & { scale?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      {...props}
      style={(state) => [
        typeof style === "function" ? style(state) : style,
        state.pressed && { opacity: 0.8, transform: scale ? [{ scale: 0.97 }] : undefined },
      ]}
    >
      {children}
    </Pressable>
  );
}

export function useScheme() {
  return useInternal().theme;
}

// ---------------------------------------------------------------- data

export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    let alive = true;
    if (tick === 0) setData(null);
    setError(null);
    load()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setRefreshing(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof YouAskedError ? e.code : "network");
        setRefreshing(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const refresh = useCallback(() => {
    setRefreshing(true);
    setTick((n) => n + 1);
  }, []);
  return { data, error, setData, refresh, refreshing };
}

export function errorText(code: string | null): string {
  switch (code) {
    case "signature_required":
    case "bad_signature":
      return "We couldn't confirm who you are. Restart the app and try again.";
    case "slow_down":
      return "That's a lot of requests in an hour. Try again a bit later.";
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

// ---------------------------------------------------------------- votes

export function useVote(client: Client, initial: FeatureRequest) {
  const [state, setState] = useState({ voted: initial.voted, votes: initial.votes });
  const busy = useRef(false);
  useEffect(() => setState({ voted: initial.voted, votes: initial.votes }), [initial.voted, initial.votes]);
  const toggle = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const before = state;
    haptic.light();
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

/** A quick squash and spring when a value flips on. */
function usePop(on: boolean) {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!on) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.14, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: useNative }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: useNative }),
    ]).start();
  }, [on, scale]);
  return scale;
}

export function VoteButton({ client, request, compact }: { client: Client; request: FeatureRequest; compact?: boolean }) {
  const { styles: s, theme } = useInternal();
  const { voted, votes, toggle } = useVote(client, request);
  const scale = usePop(voted);
  const color = voted ? theme.accentFg : theme.fg;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: voted }}
        accessibilityLabel={`${voted ? "Remove vote" : "Upvote"}: ${request.title}. ${votes} ${votes === 1 ? "vote" : "votes"}`}
        onPress={toggle}
        style={[s.vote, compact && s.voteSm, voted && s.voteOn]}
      >
        <IconUp color={color} size={compact ? 14 : 16} />
        <T style={[s.voteText, compact && s.voteTextSm, voted && s.voteTextOn]}>{votes}</T>
      </Pressable>
    </Animated.View>
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
  const { styles: s, theme } = useInternal();
  const { voted, votes, toggle } = useVote(client, request);
  const scale = usePop(voted);
  useEffect(() => onChange?.(voted), [voted, onChange]);
  const color = voted ? theme.accentFg : theme.fg;
  return (
    <Animated.View style={{ transform: [{ scale }], alignSelf: "flex-start" }}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: voted }} onPress={toggle} style={[s.bigVote, voted && s.bigVoteOn]}>
        <IconUp color={color} size={17} />
        <T style={[s.bigVoteText, voted && { color }]}>
          {voted ? "Voted" : "Upvote"} · {votes}
        </T>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- small pieces

export const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In progress",
  shipped: "Shipped",
  declined: "Not planned",
};

export function StatusPill({ status }: { status: Status }) {
  const { styles: s, theme } = useInternal();
  const tone =
    status === "planned"
      ? { bg: theme.tint, fg: theme.accent }
      : status === "in_progress"
        ? { bg: theme.amberTint, fg: theme.amber }
        : status === "shipped"
          ? { bg: theme.greenTint, fg: theme.green }
          : { bg: theme.bg, fg: theme.muted };
  return (
    <View style={[s.pill, { backgroundColor: tone.bg }]}>
      {status === "shipped" && <IconCheck color={tone.fg} size={11} />}
      <T style={[s.pillText, { color: tone.fg }]}>{STATUS_LABEL[status]}</T>
    </View>
  );
}

export function GreenDot({ size = 22 }: { size?: number }) {
  const { styles: s, theme } = useInternal();
  return (
    <View style={[s.shippedDot, { width: size, height: size, borderRadius: size / 2 }]}>
      <IconCheck color={theme.green} size={13} />
    </View>
  );
}

export function RequestRow({
  client,
  request,
  onOpen,
  compact,
  onTint,
}: {
  client: Client;
  request: FeatureRequest;
  onOpen: () => void;
  compact?: boolean;
  onTint?: boolean;
}) {
  const { styles: s, theme } = useInternal();
  return (
    <View style={[s.row, compact && s.rowSm, onTint && s.rowOnTint]}>
      <VoteButton client={client} request={request} compact={compact} />
      <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [s.rowMain, pressed && { opacity: 0.6 }]}>
        <T style={[s.rowTitle, compact && s.rowTitleSm]}>{request.title}</T>
        {(request.status !== "open" || request.comments > 0 || request.mine) && (
          <View style={s.meta}>
            {request.status !== "open" && <StatusPill status={request.status} />}
            {request.comments > 0 && (
              <View style={s.metaItem}>
                <IconChat color={theme.muted} size={13} />
                <T style={s.metaText}>{request.comments}</T>
              </View>
            )}
            {request.mine && <T style={s.metaText}>You asked</T>}
          </View>
        )}
      </Pressable>
    </View>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  const { styles: s } = useInternal();
  const o = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 1, duration: 650, useNativeDriver: useNative }),
        Animated.timing(o, { toValue: 0.55, duration: 650, useNativeDriver: useNative }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);
  return (
    <View style={s.list} accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Animated.View key={i} style={[s.skel, { opacity: o }]} />
      ))}
    </View>
  );
}

export function Badge({ count }: { count: number }) {
  const { styles: s } = useInternal();
  return (
    <View style={s.badge}>
      <T style={s.badgeText}>{count}</T>
    </View>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  const { styles: s } = useInternal();
  return (
    <View style={s.empty}>
      <T style={s.emptyTitle}>{title}</T>
      {children ? <T style={s.emptyText}>{children}</T> : null}
    </View>
  );
}

/** The app's own icon, or nothing. A guessed letter tile looks generic, so it's never drawn. */
export function AppAvatar({ icon, size = 36, round }: { icon?: ImageSourcePropType | null; size?: number; round?: boolean }) {
  const { styles: s } = useInternal();
  const [failed, setFailed] = useState(false);
  if (!icon || failed) return null;
  return (
    <Image
      source={icon}
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
      style={[s.avatar, { width: size, height: size, borderRadius: round ? size / 2 : size * 0.24 }]}
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
  const { styles: s, theme } = useInternal();
  // Inside the sheet, dragging the header also drags the sheet down.
  const drag = useContext(DragContext);
  return (
    <View style={[s.head, onBack && s.headBack]} {...(drag as object)}>
      {onBack && (
        <Tap onPress={onBack} accessibilityLabel="Back" style={[s.iconBtn, s.iconBtnPlain]}>
          <IconBack color={theme.muted} />
        </Tap>
      )}
      {leading}
      <View style={s.headText}>
        <T style={s.h} numberOfLines={1} accessibilityRole="header">
          {title}
        </T>
        {subtitle ? <T style={s.sub}>{subtitle}</T> : null}
      </View>
      {right}
      {onClose && (
        <Tap onPress={onClose} accessibilityLabel="Close" style={s.iconBtn}>
          <IconClose color={theme.muted} size={17} />
        </Tap>
      )}
    </View>
  );
}

export function LinkButton({ label, onPress, chevron }: { label: string; onPress: () => void; chevron?: boolean }) {
  const { styles: s, theme } = useInternal();
  return (
    <Tap onPress={onPress} style={s.link}>
      <T style={s.linkText}>{label}</T>
      {chevron && <IconChevron color={theme.accent} size={15} />}
    </Tap>
  );
}

export function Button({
  label,
  onPress,
  small,
  ghost,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  small?: boolean;
  ghost?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { styles: s } = useInternal();
  return (
    <Tap onPress={onPress} style={[s.btn, small && s.btnSm, ghost && s.btnGhost, style]}>
      {icon}
      <T style={[s.btnText, small && s.btnSmText, ghost && s.btnGhostText] as StyleProp<TextStyle>}>{label}</T>
    </Tap>
  );
}

/** A small iOS-style switch. */
export function Toggle({ on }: { on: boolean }) {
  const { styles: s } = useInternal();
  const x = useRef(new Animated.Value(on ? 14 : 0)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: on ? 14 : 0, friction: 7, tension: 220, useNativeDriver: useNative }).start();
  }, [on, x]);
  return (
    <View style={[s.switchTrack, on && s.switchTrackOn]}>
      <Animated.View style={[s.switchKnob, { transform: [{ translateX: x }] }]} />
    </View>
  );
}

/** Fades and nudges a screen in when it first shows. */
export function FadeIn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: useNative }).start();
  }, [v]);
  return (
    <Animated.View
      style={[
        { flex: 1, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const { styles: s } = useInternal();
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <T style={s.sectionTitle} accessibilityRole="header">
          {title}
        </T>
        {action ? <LinkButton label={action} onPress={onAction ?? (() => {})} chevron /> : null}
      </View>
      {children}
    </View>
  );
}
