# YouAsked for iOS

Feature requests your users can vote on, built into your iOS app as a real native sheet. People ask and vote without leaving the app, you hear about it on your phone, and everyone who asked is told when it ships.

Site: https://youasked.dev

- A native `.sheet` with detents on iOS 16+ (drag down to close), a keyboard-aware composer and safe areas handled for you.
- A chat-style home: greeting, "you asked, it's live" notices, popular requests, recently shipped, and a "Sounds like one of these. Vote instead?" tray that suggests existing requests before someone posts a duplicate.
- A board with Top, New and Shipped, pull to refresh, request detail with the team's replies, and a Yours list.
- Light and dark from the phone's setting, themable with one struct.
- Dynamic Type (capped at 1.3x so layouts hold) and VoiceOver labels.
- SwiftUI only, no third-party dependencies. iOS 15+.

## Install

In Xcode: File > Add Package Dependencies, then paste `https://github.com/youasked/youasked` and add the `YouAsked` library to your app.

Or in `Package.swift`:

```swift
.package(url: "https://github.com/youasked/youasked", from: "0.1.0"),
// and on your target:
.product(name: "YouAsked", package: "youasked"),
```

## Quick start

Configure once, then put `.youAsked()` on your root view:

```swift
import SwiftUI
import YouAsked

@main
struct MyApp: App {
    init() {
        YouAsked.configure(appKey: "ya_pub_…")
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .youAsked()
        }
    }
}
```

A floating button appears in the corner, and tapping it opens the sheet. Your publishable key (`ya_pub_…`) is safe to ship in the app. Get one with `npx youasked init`, or from the dashboard.

Try it without a backend: call `YouAsked.configureDemo()` instead of `configure`. It runs on sample data with a pretend team that writes back a few seconds after you post, no key or network.

Prefer a container to a modifier? `YouAskedHostView { ContentView() }` does the same.

## Signed-in users

Without this, people are anonymous (one ID per install, kept in `UserDefaults`). With sign-in, sign the user ID on your server so nobody can vote as someone else. On your server (Node 18+, an edge function, Bun or Deno):

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

In the app, fetch that and pass it in. Until you call `identify`, people are anonymous, so call it as soon as you have the answer:

```swift
struct Identity: Decodable { let id: String; let name: String?; let signature: String }

func loadIdentity() async {
    var req = URLRequest(url: URL(string: "https://your-api.example.com/api/youasked-identity")!)
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    guard let (data, _) = try? await URLSession.shared.data(for: req),
          let me = try? JSONDecoder().decode(Identity.self, from: data) else { return }
    YouAsked.identify(user: YouAskedUser(id: me.id, name: me.name), signature: me.signature)
}

// On sign-out:
YouAsked.identify(user: nil, signature: nil)
```

Never put `YOUASKED_SECRET_KEY` in the app. Passing a `name` turns on "Credit me when it ships".

## Entry points

All of them open the same sheet, in your colours and dark mode. Put `.youAsked()` on your root view first, so there is a sheet to open.

| View | Use it for |
|---|---|
| `YAAskBar()` | A chat-style input on a home screen |
| `YAFeatureCard(limit: 3)` | Top requests with vote buttons on a dashboard |
| `YARequestButton(.icon)` | A round header button, with a dot when something ships |
| `YARequestButton(.row)` | A settings row |
| `YARequestButton(.pill)` | A tinted pill anywhere |
| `YAAskAbout(topic: "charts")` | A quiet prompt next to a feature |
| `YAAskForIt(query: search)` | An empty search result that offers to ask for it |
| `YAFeatureBoard(start: .board)` | The whole experience as a screen or tab |
| `.youAsked()` launcher | The floating button, on by default |

From code, anywhere (a button, a push-notification handler):

```swift
YouAsked.open()                                    // home
YouAsked.open(topic: "charts")                     // "What would make charts better?"
YouAsked.open(.new, draft: "Export to Excel", topic: "locked")
YouAsked.open(.shipped)                            // .home .new .board .shipped .mine
YouAsked.open(requestId: "…")
YouAsked.close()
```

```swift
VStack {
    YAAskBar()
    YAFeatureCard(limit: 3)
    YARequestButton(.row, label: "Request a feature")
    Button("Export to Excel (Pro)") { YouAsked.open(.new, draft: "Export to Excel", topic: "locked") }
}
```

`YAFeatureBoard` fills its parent. Give it a screen of its own:

```swift
struct FeedbackScreen: View {
    var body: some View { YAFeatureBoard(start: .board).padding(16) }
}
```

Options on `.youAsked(...)`:

| Parameter | |
|---|---|
| `trigger` | `.floating` (default) or `.none` if you place the entry points yourself |
| `position` | `.bottomTrailing` (default) or `.bottomLeading` |
| `label` | Text next to the floating button's icon. Leave out for an icon-only bubble |
| `offset` | Points from the bottom edge, above the safe area. Use it to clear a tab bar: `offset: 60` |
| `cards` | `false` hides the "it's live", reply and "what's new" cards |

Words and the icon in the sheet are properties on `YouAsked`: `appName`, `appIcon` (`.asset("AppIcon60")`, `.image(_)` or `.url(_)`), `greeting`, `title`. `YouAsked.configure(appKey:apiURL:)` takes an `apiURL` too; it defaults to `https://api.youasked.dev`.

## Appearance

Light or dark follows the phone. To change colours, set `appearance` before the sheet opens:

```swift
YouAsked.appearance = Appearance(
    // mode: .dark,                  // force a mode (.auto follows the phone)
    accent: Color(css: "#5b3df5"),   // or any SwiftUI Color
    radius: 16,                      // cards, rows and the sheet
    buttonRadius: .pill,             // buttons, the ask bar, the composer and chips: points, or .pill
    font: "Inter-Medium"             // a font name; leave out for the system font
    // accentForeground, background, foreground, surface, border, muted
)
```

`Color(css:)` reads hex, `rgb()` and `hsl()`. Anything you leave out is derived from the accent, background and foreground, and the text colour on the accent is picked for contrast.

## Nudge

An occasional prompt, "Help shape <App>: Got an idea for <App>? Ask for a feature or vote on what others want." with Share an idea and Not now. You turn it on and tune it in the dashboard; the app picks the settings up from the server:

- `everyDays`: at most one prompt per this many days.
- `activeSeconds`: seconds with the app in front of the person, in this visit, before it shows.
- `skipVisits`: visits to skip first, so new people can look around. A visit is a launch, or coming back after 30 minutes away.
- `position`: `bottom` or `top`.

It never shows twice inside the interval, waits twice as long after each dismissal (up to 8x), stays away from people who opened the sheet recently, and waits while the sheet or an "it's live" card is on screen. Override the dashboard in code:

```swift
YouAsked.nudge = .off                                     // never
YouAsked.nudge = .on                                      // dashboard settings, or the defaults
YouAsked.nudge = .custom(NudgeSettings(everyDays: 3, activeSeconds: 20, skipVisits: 0,
                                       message: "Missing something?"))
```

## When something ships

When a request someone asked for or voted on ships, they get a card the next time the app opens ("You asked for this. It's live."), with a haptic, and a "what's new" bubble at the top of the sheet. Replies from your team show up the same way. Ship from a commit: `closes YA-12` on your default branch marks request YA-12 shipped and tells everyone who asked.

## Test mode

Until your workspace has a subscription, YouAsked answers requests from development builds only. Debug builds send `x-youasked-dev: 1`, which test mode allows. In a release build the API answers `402 test_mode`; the SDK then renders nothing, shows no button, and prints one console line. Nothing crashes.

## Screenshots ("Show us")

Not built in. If you have a way to capture the screen, return an image and the composer shows a "Show us" button that attaches it:

```swift
YouAsked.captureScreenshot = {
    UIGraphicsImageRenderer(bounds: window.bounds).image { _ in window.drawHierarchy(in: window.bounds, afterScreenUpdates: true) }
}
```

## Try the example

`Example/` is a small app that shows every entry point on the demo backend. `cd Example && xcodegen generate`, then open `YouAskedExample.xcodeproj`. Launch arguments such as `-scene board`, `-nudge 1` and `-custom 1` jump to a state.

## Notes

- Swift 5 language mode, Swift 5.9 tools. No dependencies.
- The sheet starts at full height and can be dragged to a medium detent on iOS 16+; on iOS 15 it is a standard sheet.
- Unit tests: `xcodebuild test -scheme YouAsked -destination 'platform=iOS Simulator,name=iPhone 17 Pro'` from the repo root.

MIT licensed.
