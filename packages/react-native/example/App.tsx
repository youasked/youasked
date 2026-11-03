import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import {
  AskAbout,
  AskBar,
  AskForIt,
  FeatureBoard,
  FeatureCard,
  RequestButton,
  YouAsked,
  openYouAsked,
  useYouAsked,
} from "../src";

// Everything in the SDK, running against the built-in fake backend (`demo`), so no key or network is needed.
// In a real app, drop `demo` and pass `appKey="ya_pub_…"` instead.

type Screen = "home" | "board";

/** Lets a test run pick the screen and open the sheet from the URL (react-native-web only). */
function fromUrl(): { screen: Screen; open?: string; scheme?: "light" | "dark" } {
  const search = (globalThis as { location?: { search?: string } }).location?.search ?? "";
  const q = new URLSearchParams(search);
  return {
    screen: q.get("screen") === "board" ? "board" : "home",
    open: q.get("open") ?? undefined,
    scheme: q.get("scheme") === "dark" ? "dark" : q.get("scheme") === "light" ? "light" : undefined,
  };
}

function Content({ screen, setScreen, dark }: { screen: Screen; setScreen: (s: Screen) => void; dark: boolean }) {
  const { open, unseenCount } = useYouAsked();
  const [query, setQuery] = useState("export to pdf");
  const bg = dark ? "#0b1020" : "#f4f6fb";
  const fg = dark ? "#f4f6fa" : "#141b2d";
  const muted = dark ? "#9aa3b8" : "#5d667d";
  const url = fromUrl();

  useEffect(() => {
    if (!url.open) return;
    const t = setTimeout(() => {
      if (url.open === "sheet") open();
      if (url.open === "board") open({ view: "board" });
      if (url.open === "detail") open({ requestId: "demo_12" });
      if (url.open === "new") open({ view: "new", topic: "charts" });
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {screen === "home" ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.h1, { color: fg }]}>Hello, Sam</Text>
          <Text style={[styles.p, { color: muted }]}>Your spending this month is on track.</Text>

          <Text style={[styles.label, { color: muted }]}>AskBar</Text>
          <AskBar />

          <Text style={[styles.label, { color: muted }]}>FeatureCard</Text>
          <FeatureCard />

          <Text style={[styles.label, { color: muted }]}>RequestButton</Text>
          <View style={styles.row}>
            <RequestButton variant="pill" />
            <RequestButton variant="icon" />
          </View>
          <View style={{ height: 10 }} />
          <RequestButton variant="row" />

          <Text style={[styles.label, { color: muted }]}>AskAbout and AskForIt</Text>
          <AskAbout topic="charts" />
          <AskForIt query={query} />

          <Text style={[styles.label, { color: muted }]}>useYouAsked / openYouAsked</Text>
          <View style={styles.row}>
            <Pressable style={styles.plain} onPress={() => open({ view: "new", draft: "Export to Excel", topic: "locked" })}>
              <Text style={styles.plainText}>Locked feature ({unseenCount})</Text>
            </Pressable>
            <Pressable style={styles.plain} onPress={() => openYouAsked({ view: "shipped" })}>
              <Text style={styles.plainText}>Shipped list</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.boardWrap}>
          <FeatureBoard start="board" />
        </View>
      )}
      <View style={[styles.tabs, { backgroundColor: dark ? "#161d31" : "#fff" }]}>
        {(["home", "board"] as const).map((s) => (
          <Pressable key={s} style={styles.tab} onPress={() => setScreen(s)}>
            <Text style={{ color: screen === s ? "#2b4bee" : muted, fontWeight: "700" }}>{s === "home" ? "Home" : "Feedback"}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function App() {
  const system = useColorScheme();
  const url = fromUrl();
  const [screen, setScreen] = useState<Screen>(url.screen);
  const mode = url.scheme ?? (system === "dark" ? "dark" : "light");
  return (
    <>
      <YouAsked
        demo
        appName="Penny"
        user={{ id: "u_1", name: "Sam" }}
        appearance={{ mode }}
        offset={64}
        trigger="floating"
      >
        <Content screen={screen} setScreen={setScreen} dark={mode === "dark"} />
      </YouAsked>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 56 },
  scroll: { padding: 20, paddingBottom: 140, gap: 6 },
  boardWrap: { flex: 1, padding: 16, paddingBottom: 8 },
  h1: { fontSize: 28, fontWeight: "800" },
  p: { fontSize: 15, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 20, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  plain: { backgroundColor: "#e3e7f5", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  plainText: { color: "#141b2d", fontWeight: "600" },
  tabs: { flexDirection: "row", height: 56 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
});
