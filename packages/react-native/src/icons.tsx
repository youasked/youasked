// Icons drawn with plain Views, so there's no SVG dependency and they look the same everywhere.
import { View } from "react-native";

type P = { color: string; size?: number };

function Bar({ w, h, color, rotate, x = 0, y = 0 }: { w: number; h: number; color: string; rotate?: string; x?: number; y?: number }) {
  return (
    <View
      style={{
        position: "absolute",
        width: w,
        height: h,
        borderRadius: Math.min(w, h) / 2,
        backgroundColor: color,
        transform: [{ translateX: x }, { translateY: y }, ...(rotate ? [{ rotate }] : [])],
      }}
    />
  );
}

const box = (size: number) => ({ width: size, height: size, alignItems: "center" as const, justifyContent: "center" as const });

type Dir = "up" | "down" | "left" | "right";
const ROT: Record<Dir, string> = { right: "-45deg", down: "45deg", left: "135deg", up: "-135deg" };

export function IconChevron({ color, size = 18, dir = "right", stroke = 2.2 }: P & { dir?: Dir; stroke?: number }) {
  const s = size * 0.42;
  const nudge = size * 0.07;
  return (
    <View style={box(size)}>
      <View
        style={{
          width: s,
          height: s,
          borderRightWidth: stroke,
          borderBottomWidth: stroke,
          borderColor: color,
          borderBottomRightRadius: 1.5,
          transform: [
            { translateX: dir === "right" ? -nudge : dir === "left" ? nudge : 0 },
            { translateY: dir === "down" ? -nudge : dir === "up" ? nudge : 0 },
            { rotate: ROT[dir] },
          ],
        }}
      />
    </View>
  );
}

export const IconBack = ({ color, size = 20 }: P) => <IconChevron color={color} size={size} dir="left" />;

export function IconUp({ color, size = 16 }: P) {
  return <IconChevron color={color} size={size} dir="up" stroke={2.6} />;
}

export function IconClose({ color, size = 18 }: P) {
  return (
    <View style={box(size)}>
      <Bar w={size * 0.7} h={2.2} color={color} rotate="45deg" />
      <Bar w={size * 0.7} h={2.2} color={color} rotate="-45deg" />
    </View>
  );
}

export function IconPlus({ color, size = 18 }: P) {
  return (
    <View style={box(size)}>
      <Bar w={size * 0.62} h={2.4} color={color} />
      <Bar w={2.4} h={size * 0.62} color={color} />
    </View>
  );
}

export function IconCheck({ color, size = 13 }: P) {
  return (
    <View style={box(size)}>
      <View
        style={{
          width: size * 0.62,
          height: size * 0.34,
          borderLeftWidth: 2.4,
          borderBottomWidth: 2.4,
          borderColor: color,
          transform: [{ translateY: -size * 0.06 }, { rotate: "-45deg" }],
        }}
      />
    </View>
  );
}

export function IconSend({ color, size = 18 }: P) {
  return (
    <View style={box(size)}>
      <Bar w={2.4} h={size * 0.62} color={color} y={size * 0.06} />
      <View style={{ position: "absolute", top: size * 0.06 }}>
        <IconChevron color={color} size={size * 0.8} dir="up" stroke={2.4} />
      </View>
    </View>
  );
}

/** The ask mark: a speech bubble holding the vote arrow. `ink` colours the arrow. */
export function IconIdea({ color, size = 22, ink = "#fff" }: P & { ink?: string }) {
  const u = size / 24;
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: "absolute", left: 1.5 * u, top: 2.25 * u, width: 21 * u, height: 17.25 * u, borderRadius: 4.5 * u, backgroundColor: color }} />
      {/* The tail: a right triangle under the bubble's bottom-left. */}
      <View
        style={{
          position: "absolute",
          left: 6 * u,
          top: 19.4 * u,
          width: 0,
          height: 0,
          borderTopWidth: 3.85 * u,
          borderTopColor: color,
          borderRightWidth: 5.25 * u,
          borderRightColor: "transparent",
        }}
      />
      <View style={{ position: "absolute", left: 0, top: -1.1 * u, width: size, height: size * 0.9, alignItems: "center", justifyContent: "center" }}>
        <IconChevron color={ink} size={size * 0.5} dir="up" stroke={Math.max(2, 2.6 * u)} />
      </View>
    </View>
  );
}

export function IconChat({ color, size = 13 }: P) {
  return (
    <View style={box(size)}>
      <View style={{ width: size * 0.86, height: size * 0.68, borderRadius: size * 0.22, borderWidth: 1.6, borderColor: color }} />
      <View
        style={{
          position: "absolute",
          bottom: size * 0.1,
          left: size * 0.2,
          width: size * 0.2,
          height: size * 0.2,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

export function IconFrame({ color, size = 16 }: P) {
  return (
    <View style={box(size)}>
      <View style={{ width: size * 0.78, height: size * 0.78, borderRadius: size * 0.2, borderWidth: 1.8, borderColor: color, borderStyle: "dashed" }} />
    </View>
  );
}

export function IconSpark({ color, size = 18 }: P) {
  const s = size * 0.5;
  return (
    <View style={box(size)}>
      <View style={{ position: "absolute", width: s, height: s, borderRadius: 2, backgroundColor: color, transform: [{ rotate: "45deg" }] }} />
      <View style={{ position: "absolute", width: s, height: s, borderRadius: 2, backgroundColor: color }} />
    </View>
  );
}
