# YouAsked for Android

Feature requests your users can vote on, built into your Android app as a native Compose bottom sheet. People ask and vote without leaving the app, you hear about it on your phone, and everyone who asked is told when it ships.

Site: https://youasked.dev

- A Material 3 bottom sheet you can drag down to close, with a composer that sits on the keyboard (edge-to-edge safe), system insets and the back button.
- A chat-style home: greeting, "you asked, it's live" notices, popular requests, recently shipped, and an "already asked?" tray that suggests existing requests before someone posts a duplicate.
- A board with Top, New and Shipped, pull to refresh, request detail with the team's replies, and a Yours list.
- Light and dark from the system setting, themable with one parameter.
- Kotlin and Jetpack Compose only. The library uses `HttpURLConnection` and `org.json`: no OkHttp, no Retrofit, no image loader.
- minSdk 24, compileSdk 36.

## Install

Add JitPack to `settings.gradle.kts`:

```kotlin
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven("https://jitpack.io")
    }
}
```

Then the dependency (versions are the tags at https://github.com/youasked/youasked/tags):

```kotlin
dependencies {
    implementation("com.github.youasked:youasked:0.1.0")
}
```

The library needs the `INTERNET` permission; it adds it to your manifest for you.

## Configure

Once, in `Application.onCreate`. Your publishable key (`ya_pub_…`) is safe to ship in the app. Get one with `npx youasked init`, or from the dashboard.

```kotlin
class App : Application() {
    override fun onCreate() {
        super.onCreate()
        YouAsked.configure(this, appKey = "ya_pub_…")
    }
}
```

`configure` also takes `apiUrl` (defaults to `https://api.youasked.dev`). Try it without a backend: `YouAsked.configureDemo(this)` runs on sample requests with a pretend team, no key or network.

Then wrap your UI once, near the root:

```kotlin
setContent {
    MyTheme {
        YouAskedHost(appName = "Acme") {
            MyAppContent()
        }
    }
}
```

That's it: a floating button appears in the corner, and tapping it opens the sheet. `YouAskedHost` also shows the cards and the nudge, below.

Call `enableEdgeToEdge()` in your activity (the default on Android 15+). The sheet reads the keyboard and navigation bar insets itself, so the composer sits flush on the keyboard.

## Signed-in users

Without this, people are anonymous (one random ID per install, kept in SharedPreferences). With sign-in, sign the user ID on your server so nobody can vote as someone else. On your server (Node 18+, an edge function, Bun or Deno):

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

In the app, fetch that after sign-in and pass it in. Call it before the sheet opens, and again with `null` on sign-out:

```kotlin
val identity = api.youAskedIdentity()           // your own call, behind your own auth
YouAsked.identify(YouAskedUser(id = identity.id, name = identity.name), identity.signature)

// signed out
YouAsked.identify(null)
```

Never put `YOUASKED_SECRET_KEY` in the app. Passing a `name` turns on "Credit me when it ships".

## Entry points

All of them open the same sheet, in your colours and dark mode. Use them inside `YouAskedHost`.

| Composable | Use it for |
|---|---|
| `AskBar()` | A chat-style input on a home screen |
| `FeatureCard()` | Top requests with vote buttons on a dashboard |
| `RequestButton(variant = Icon)` | A round header button, with a dot when something ships |
| `RequestButton(variant = Row)` | A settings row |
| `RequestButton(variant = Pill)` | A tinted pill anywhere |
| `AskAbout("charts")` | A quiet prompt next to a feature |
| `AskForIt(query)` | An empty search result that offers to ask for it |
| `FeatureBoard()` | The whole experience as a screen or tab |
| `YouAsked.open(...)` | Any button, such as a locked feature, or from anywhere (a notification handler) |

```kotlin
@Composable
fun Home() {
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        AskBar()
        FeatureCard(limit = 3)
        RequestButton(variant = RequestButtonVariant.Row)
        Button(onClick = { YouAsked.open(OpenOptions(view = OpenView.New, draft = "Export to Excel", topic = "locked")) }) {
            Text("Export to Excel (Pro)")
        }
    }
}
```

`YouAsked.open()` opens the home screen. `YouAsked.open("charts")` opens the composer already asking "What would make charts better?", and the request is saved with that topic. `YouAsked.open(OpenOptions(...))` takes `view` (`Home`, `New`, `Board`, `Shipped`, `Mine`), `requestId`, `draft`, `topic` and `placeholder`.

`FeatureBoard()` fills its parent. Give it a screen of its own:

```kotlin
FeatureBoard(Modifier.fillMaxSize().padding(16.dp), startOnBoard = true)
```

To show how many replies and "it's live" notices are waiting on your own button, read `YouAsked.unseenCount` in composition.

## Parameters of `YouAskedHost`

| Parameter | |
|---|---|
| `appearance` | Colours, radius and font, see below |
| `trigger` | `LauncherTrigger.Floating` (default) or `None` if you place the entry points yourself |
| `position` | `LauncherPosition.BottomEnd` (default) or `BottomStart` |
| `label` | Text next to the floating button's icon. Leave out for an icon-only bubble |
| `offset` | Distance from the bottom edge, above the navigation bar, for the floating button and cards. Use it to clear a bottom bar: `offset = 80.dp` |
| `appName`, `appIcon`, `greeting`, `title` | Words and the icon in the sheet. `appIcon` is `YouAskedIcon.Resource(id)`, `.Url(url)` or `.Custom(painter)` |
| `cards` | Set false to hide the "it's live" and "what's new" cards |
| `nudge` | The occasional prompt, see below |
| `captureScreenshot` | Optional "Show us" button, see below |

## Appearance

Light or dark follows the system. To change colours, pass `appearance`:

```kotlin
YouAskedHost(
    appearance = YouAskedAppearance(
        accent = Color(0xFF5B3DF5),
        radius = 16.dp,                       // cards, rows and the sheet
        buttonRadius = ButtonRadius.Pill,     // buttons, ask bar, composer, chips: ButtonRadius.Of(10.dp) or Pill
        fontFamily = FontFamily(Font(R.font.inter)),
        // mode = YouAskedMode.Dark,          // force a mode (Auto follows the system)
        // background, foreground, surface, border, muted, accentForeground
    ),
) { … }
```

Anything you leave out is derived from the accent, background and foreground, and the text colour on the accent is picked for contrast.

## When something ships

When a request someone asked for or voted on ships, they get a card the next time the app opens ("You asked for this. It's live."), with a haptic, and a "what's new" bubble at the top of the sheet. A team reply shows as a card too. Ship from a commit: `closes YA-12` on your default branch marks request YA-12 shipped and tells everyone who asked.

## The nudge

An occasional card, "Help shape Acme: Got an idea for Acme? Share an idea / Not now". You turn it on and tune it in the dashboard; the app picks the settings up from the server. It:

- waits until someone has had the app in the foreground for `activeSeconds` in this visit,
- skips their first `skipVisits` visits,
- shows at most once every `everyDays` days,
- steps back further each time it's dismissed (2x, 4x, 8x the interval), and
- stays away from people who opened the sheet recently, and while a reply or "it's live" card is showing.

It's remembered per install (and per user) in SharedPreferences. To override the dashboard from code:

```kotlin
YouAskedHost(nudge = YouAskedNudge.Custom(everyDays = 14, activeSeconds = 60, message = "Missing something?")) { … }
YouAskedHost(nudge = YouAskedNudge.Off) { … }          // never
YouAskedHost(nudge = YouAskedNudge.Dashboard) { … }    // the default
```

## Test mode

Until your workspace has a subscription, YouAsked answers requests from development builds only: debug builds send `x-youasked-dev: 1`. In a release build the API answers `402 test_mode`; the SDK then renders nothing, shows no button, and logs one warning. Nothing crashes.

## Screenshots ("Show us")

Not built in. If you have a way to capture the screen, pass `captureScreenshot` and the composer shows a "Show us" button that attaches the PNG bytes you return (or null if they cancel):

```kotlin
YouAskedHost(captureScreenshot = { myScreenshotter.capturePng() }) { … }
```

## Accessibility

Buttons, tabs, votes, switches and cards have TalkBack labels and states (a vote reads "Upvote: Dark mode. 8 votes"), new cards announce themselves, and touch targets are at least 48dp.

## Notes

- Dependencies: Compose (`ui`, `foundation`, `material3`), `androidx.activity-compose`, `lifecycle-runtime-compose`, coroutines.
- Try the sample: `packages/android/sample`. Put `youasked.appKey=ya_pub_…` in `packages/android/local.properties` (gitignored), or leave it out to run in demo mode.

MIT licensed.
