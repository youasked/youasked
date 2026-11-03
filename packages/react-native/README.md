# @youasked/react-native

Feature requests your users can vote on, built into your React Native or Expo app as a real native bottom sheet. People ask and vote without leaving the app, you hear about it on your phone, and everyone who asked is told when it ships.

Site: https://youasked.dev

- A bottom sheet you can drag down to close, with a keyboard-aware composer, safe areas and the Android back button.
- A chat-style home: greeting, "you asked, it's live" notices, popular requests, recently shipped, and an "already asked?" tray that suggests existing requests before someone posts a duplicate.
- A board with Top, New and Shipped, pull to refresh, request detail with the team's replies, and a Yours list.
- Light and dark from the phone's setting, themable with one prop.
- No native build step. It only needs `react` and `react-native`, so it works in Expo Go, Expo dev builds and bare apps. No reanimated, gesture-handler or bottom-sheet library.

## Quick start: Expo

```sh
npx expo install @youasked/react-native @react-native-async-storage/async-storage expo-haptics
```

`@react-native-async-storage/async-storage` keeps one anonymous ID per install, so a person's votes and requests survive an app restart. `expo-haptics` adds a tap on vote and a buzz when something ships. Both are optional: without them the SDK falls back to memory (with a console warning) and stays silent.

Wrap your app once, near the root (in Expo Router that is `app/_layout.tsx`):

```tsx
import { YouAsked } from "@youasked/react-native";

export default function RootLayout() {
  return (
    <YouAsked appKey="ya_pub_…">
      <Stack />
    </YouAsked>
  );
}
```

That's it: a floating button appears in the corner, and tapping it opens the sheet. Your publishable key (`ya_pub_…`) is safe to ship in the app. Get one with `npx youasked init`, or from the dashboard.

Try it without a backend: add the `demo` prop and it runs on sample data, no key or network.

## Quick start: bare React Native

```sh
npm i @youasked/react-native @react-native-async-storage/async-storage
cd ios && pod install
```

```tsx
import { YouAsked } from "@youasked/react-native";

export default function App() {
  return (
    <YouAsked appKey="ya_pub_…">
      <Navigation />
    </YouAsked>
  );
}
```

Put `<YouAsked>` at the root, so the floating button and cards sit above your screens. If your app already uses `react-native-safe-area-context`, YouAsked uses its insets automatically. Without it, it estimates them.

## Entry points

All of them open the same sheet, in your colours and dark mode. Use them inside `<YouAsked>`.

| Component | Use it for |
|---|---|
| `<AskBar />` | A chat-style input on a home screen |
| `<FeatureCard />` | Top requests with vote buttons on a dashboard |
| `<RequestButton variant="icon" />` | A round header button, with a dot when something ships |
| `<RequestButton variant="row" />` | A settings row |
| `<RequestButton variant="pill" />` | A tinted pill anywhere |
| `<AskAbout topic="charts" />` | A quiet prompt next to a feature |
| `<AskForIt query={search} />` | An empty search result that offers to ask for it |
| `<FeatureBoard />` | The whole experience as a screen or tab |
| `useYouAsked().open({ view: "new", draft: "Export to Excel" })` | Any button, such as a locked feature |
| `openYouAsked({ view: "shipped" })` | From anywhere, even outside React, such as a push-notification handler |

```tsx
import { AskBar, FeatureCard, RequestButton, useYouAsked } from "@youasked/react-native";

function Home() {
  const { open } = useYouAsked();
  return (
    <>
      <AskBar />
      <FeatureCard limit={3} />
      <RequestButton variant="row" label="Request a feature" />
      <Button title="Export to Excel (Pro)" onPress={() => open({ view: "new", draft: "Export to Excel", topic: "locked" })} />
    </>
  );
}
```

`open()` takes `view` (`"home"`, `"new"`, `"board"`, `"shipped"`, `"mine"`), `requestId`, `draft`, `topic` and `placeholder`.

`<FeatureBoard />` fills its parent. Give it a screen of its own:

```tsx
export default function FeedbackScreen() {
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <FeatureBoard start="board" />
    </View>
  );
}
```

## Props of `<YouAsked>`

| Prop | |
|---|---|
| `appKey` | Publishable key, `ya_pub_…` |
| `user`, `signature`, `ready` | Signed-in users, see below |
| `appearance` | Colours, radius and font, see below |
| `trigger` | `"floating"` (default) or `"none"` if you place the entry points yourself |
| `position` | `"bottom-right"` (default) or `"bottom-left"` |
| `label` | Text next to the floating button's icon. Leave out for an icon-only bubble |
| `offset` | Points from the bottom edge, above the safe area, for the floating button and cards. Use it to clear a tab bar: `offset={60}` |
| `appName`, `appIcon`, `greeting`, `title` | Words and the icon in the sheet. `appIcon` is a URL or `require("./icon.png")` |
| `cards` | Set false to hide the "it's live" and "what's new" cards |
| `demo` | Fake data, no network |
| `apiUrl` | Defaults to `https://api.youasked.dev` |
| `captureScreenshot` | Optional "Show us" button, see below |

## Signed-in users

Without this, people are anonymous (one ID per install). With sign-in, sign the user ID on your server so nobody can vote as someone else. On your server (Node 18+, an edge function, Bun or Deno):

```ts
import { signUser } from "@youasked/react/server";

// e.g. GET /api/youasked-identity, behind your own auth
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({
    id: user.id,
    name: user.name,
    signature: await signUser(process.env.YOUASKED_SECRET_KEY!, user.id),
  });
}
```

In the app, fetch that and pass it in. `ready={false}` makes the widget wait instead of acting anonymously:

```tsx
function Feedback({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<{ id: string; name?: string; signature: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("https://your-api.example.com/api/youasked-identity", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setIdentity)
      .finally(() => setLoaded(true));
  }, []);

  return (
    <YouAsked
      appKey="ya_pub_…"
      ready={loaded}
      user={identity ? { id: identity.id, name: identity.name } : null}
      signature={identity?.signature}
    >
      {children}
    </YouAsked>
  );
}
```

Never put `YOUASKED_SECRET_KEY` in the app. Passing a `name` turns on "Credit me when it ships".

## Theming

Light or dark follows the phone. To change colours, pass `appearance`:

```tsx
<YouAsked
  appKey="ya_pub_…"
  appearance={{
    accent: "#5b3df5",
    radius: 16,
    fontFamily: "Inter_500Medium",
    // mode: "dark",         // force a mode ("auto" follows the phone)
    // background, foreground, surface, border, muted, accentForeground
  }}
/>
```

Colours are hex, `rgb()` or `hsl()`. Anything you leave out is derived from the accent, background and foreground, and the text colour on the accent is picked for contrast.

## When something ships

When a request someone asked for or voted on ships, they get a card the next time the app opens ("You asked for this. It's live."), with a haptic if `expo-haptics` is installed, and a "what's new" bubble at the top of the sheet. Ship from a commit: `closes YA-12` on your default branch marks request YA-12 shipped and tells everyone who asked.

## Test mode

Until your workspace has a subscription, YouAsked answers requests from local development only. In any other build the API answers `402 test_mode`; the SDK then renders nothing, shows no button, and logs one console warning. Nothing crashes.

## Screenshots ("Show us")

Not built in on mobile yet. If you have a capture library, pass `captureScreenshot` and the composer shows a "Show us" button that attaches what you return:

```tsx
import { captureScreen } from "react-native-view-shot";

<YouAsked appKey="ya_pub_…" captureScreenshot={async () => ({ uri: await captureScreen({ format: "png" }) })} />
```

## Notes

- Peers are `react` and `react-native` only. `expo-haptics`, `@react-native-async-storage/async-storage` and `react-native-safe-area-context` are optional and detected at runtime.
- The keyboard lift is measured, so it works with `adjustResize`, edge-to-edge Android and iOS.
- Works with the New Architecture and Hermes.

MIT licensed.
