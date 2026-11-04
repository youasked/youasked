import { useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useInternal, type Route } from "./context";
import { IconCheck, IconChevron, IconIdea, IconSend } from "./icons";
import { Navigator } from "./views";
import { AppAvatar, Badge, Button, RequestRow, Skeleton, T, Tap, useLoad } from "./ui";

// Inline entry points. Each renders inside your layout and opens the same sheet.
// They render nothing while the app is in test mode for this build.

type Common = { style?: StyleProp<ViewStyle> };

/** A chat-style input bar. Tapping it opens the composer. Good at the top of a home screen or under an empty state. */
export function AskBar({ placeholder = "Ask for a feature…", style }: Common & { placeholder?: string }) {
  const { open, appIcon, unseenCount, styles: s, theme, disabled } = useInternal();
  if (disabled) return null;
  return (
    <Tap onPress={() => open({ view: "new" })} accessibilityLabel={placeholder} style={[s.askbar, style]}>
      {appIcon ? (
        <AppAvatar icon={appIcon} size={30} />
      ) : (
        <View style={s.askbarGlyph}>
          <IconIdea color={theme.accent} ink={theme.bg} size={18} />
        </View>
      )}
      <T style={s.askbarText} numberOfLines={1}>
        {placeholder}
      </T>
      {unseenCount > 0 && <Badge count={unseenCount} />}
      <View style={s.askbarSend}>
        <IconSend color={theme.accentFg} size={17} />
      </View>
    </Tap>
  );
}

/** A card with the top requests and vote buttons, for a dashboard or home tab. */
export function FeatureCard({
  heading = "Shape what's next",
  description = "Vote on ideas or suggest your own",
  limit = 3,
  style,
}: Common & { heading?: string; description?: string; limit?: number }) {
  const { client, open, config, markSeen, styles: s, theme, disabled } = useInternal();
  const { data } = useLoad(() => (disabled ? Promise.resolve([]) : client.list("top", "active")), [client, disabled]);
  if (disabled) return null;
  const notice = config?.unseen.find((n) => n.kind === "shipped");
  return (
    <View style={[s.card, style]}>
      <View style={s.cardHead}>
        <View style={s.cardIcon}>
          <IconIdea color={theme.accent} ink={theme.bg} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <T style={s.cardTitle}>{heading}</T>
          <T style={s.cardSub}>{description}</T>
        </View>
      </View>
      {notice && (
        <Tap
          onPress={() => {
            markSeen([notice.id]);
            open({ requestId: notice.requestId });
          }}
          style={s.cardWin}
        >
          <View style={s.shippedDot}>
            <IconCheck color={theme.green} />
          </View>
          <T style={{ flex: 1, fontSize: 14, lineHeight: 19 }}>
            You asked for <T style={s.bold}>{notice.title}</T>. It's live.
          </T>
          <IconChevron color={theme.muted} size={16} />
        </Tap>
      )}
      {!data ? (
        <Skeleton rows={2} />
      ) : data.length > 0 ? (
        <View style={s.list}>
          {data.slice(0, limit).map((r) => (
            <RequestRow key={r.id} client={client} request={r} compact onOpen={() => open({ requestId: r.id })} />
          ))}
        </View>
      ) : null}
      <View style={s.cardActions}>
        <Button small label="Suggest an idea" onPress={() => open({ view: "new" })} style={{ flex: 1 }} />
        {data && data.length > limit && (
          <Button small ghost label={`See all ${data.length}`} onPress={() => open({ view: "board" })} style={{ flex: 1 }} />
        )}
      </View>
    </View>
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
  style,
}: Common & { variant?: "pill" | "icon" | "row"; label?: string; sublabel?: string }) {
  const { open, unseenCount, styles: s, theme, disabled } = useInternal();
  if (disabled) return null;
  if (variant === "icon") {
    return (
      <Tap onPress={() => open()} accessibilityLabel={label} style={[s.iconBtnRound, style]}>
        <IconIdea color={theme.fg} ink={theme.bg} size={22} />
        {unseenCount > 0 && <View style={[s.dot, s.dotAbs]} />}
      </Tap>
    );
  }
  if (variant === "row") {
    return (
      <Tap onPress={() => open()} style={[s.menuRow, style]}>
        <View style={[s.cardIcon, { width: 32, height: 32 }]}>
          <IconIdea color={theme.accent} ink={theme.bg} size={18} />
        </View>
        <View style={s.menuText}>
          <T style={s.menuLabel}>{label}</T>
          {sublabel ? <T style={s.menuSub}>{sublabel}</T> : null}
        </View>
        {unseenCount > 0 && <Badge count={unseenCount} />}
        <IconChevron color={theme.muted} size={17} />
      </Tap>
    );
  }
  return (
    <Tap onPress={() => open()} style={[s.pillBtn, style]}>
      <IconIdea color={theme.accent} ink={theme.bg} size={18} />
      <T style={s.pillBtnText}>{label}</T>
      {unseenCount > 0 && <Badge count={unseenCount} />}
    </Tap>
  );
}

/**
 * A quiet line next to a feature: "Want more from charts?". Opens the composer already about that
 * topic, and the request is saved with it so you can see which feature people are asking about.
 */
export function AskAbout({ topic, prompt, style }: Common & { topic: string; prompt?: string }) {
  const { open, styles: s, theme, disabled } = useInternal();
  if (disabled) return null;
  return (
    <Tap onPress={() => open({ view: "new", topic })} style={[s.askAbout, style]}>
      <IconIdea color={theme.accent} ink={theme.bg} size={15} />
      <T style={s.askAboutText}>{prompt ?? `Want more from ${topic}?`}</T>
    </Tap>
  );
}

/**
 * For an empty search: "Can't find “export”? Ask for it". Opens the composer with the search as the
 * draft, tagged as a search so you can tell what people looked for and didn't find.
 */
export function AskForIt({ query, style }: Common & { query: string }) {
  const { open, styles: s, theme, disabled } = useInternal();
  if (disabled) return null;
  const q = query.trim();
  const shown = q.length > 40 ? `${q.slice(0, 39).trimEnd()}…` : q;
  return (
    <Tap onPress={() => open({ view: "new", draft: q, topic: "search" })} style={[s.askForIt, style]}>
      <T style={s.askForItText}>{shown ? `Can't find “${shown}”?` : "Can't find it?"}</T>
      <View style={s.askForItCta}>
        <T style={s.askForItCtaText}>Ask for it</T>
        <IconChevron color={theme.accent} size={16} />
      </View>
    </Tap>
  );
}

/** The whole experience inline, for a settings screen or a tab. Fills its parent unless you give it a height. */
export function FeatureBoard({
  start = "home",
  height,
  style,
}: Common & { start?: "home" | "board"; height?: number }) {
  const { styles: s, disabled } = useInternal();
  const [route, setRoute] = useState<Route>(start === "board" ? { view: "board" } : { view: "home" });
  if (disabled) return null;
  return (
    <View style={[s.embed, height === undefined ? { flex: 1 } : { height }, style]}>
      <Navigator route={route} setRoute={setRoute} />
    </View>
  );
}
