import SwiftUI
import YouAsked

// Everything in the SDK against the built-in demo backend, so it runs without a key or network.
// Launch arguments pick what to show, for screenshots and testing:
//   -scene home|board|detail|new|mine|none   open the sheet there after a moment (default none)
//   -news 0                                   start without the "it's live" card
//   -nudge 1                                  turn the nudge on, showing after 2 seconds
//   -custom 1                                 try a custom Appearance (purple, pill buttons)
//   -live 1                                   use the real API with the key in env YOUASKED_KEY (debug builds only)

@main
struct ExampleApp: App {
    init() {
        let d = UserDefaults.standard
        if d.bool(forKey: "live"), let key = ProcessInfo.processInfo.environment["YOUASKED_KEY"] {
            YouAsked.configure(appKey: key)
        } else {
            YouAsked.configureDemo(appName: "Pennywise", showsNews: d.object(forKey: "news") == nil || d.bool(forKey: "news"))
        }
        if d.bool(forKey: "nudge") { YouAsked.nudge = .custom(NudgeSettings(everyDays: 7, activeSeconds: 2, skipVisits: 0)) }
        if d.bool(forKey: "custom") {
            YouAsked.appearance = Appearance(accent: Color(css: "#7c3aed"), radius: 18, buttonRadius: .pill)
        }
    }

    var body: some Scene {
        WindowGroup {
            HomeScreen()
                .youAsked(trigger: .floating, label: nil)
        }
    }
}

struct HomeScreen: View {
    @Environment(\.colorScheme) private var scheme
    @State private var search = "export to pdf"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Hello, Sam").font(.largeTitle.bold())
                        Text("Your spending this month is on track.").foregroundColor(.secondary)
                    }
                    Spacer()
                    YARequestButton(.icon)
                }
                label("YAAskBar")
                YAAskBar()
                label("YAFeatureCard")
                YAFeatureCard(limit: 2)
                label("YARequestButton")
                YARequestButton(.row)
                HStack { YARequestButton(.pill); Spacer() }
                label("YAAskAbout")
                YAAskAbout(topic: "charts")
                label("YAAskForIt")
                YAAskForIt(query: search)
            }
            .padding(16)
            .padding(.bottom, 80)
        }
        .background((scheme == .dark ? Color(red: 0.04, green: 0.06, blue: 0.12) : Color(red: 0.96, green: 0.97, blue: 0.98)).ignoresSafeArea())
        .task {
            let scene = UserDefaults.standard.string(forKey: "scene") ?? "none"
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            switch scene {
            case "home": YouAsked.open()
            case "new": YouAsked.open(topic: "charts")
            case "board": YouAsked.open(.board)
            case "mine": YouAsked.open(.mine)
            case "detail": YouAsked.open(requestId: "demo_12")
            default: break
            }
        }
    }

    private func label(_ s: String) -> some View {
        Text(s).font(.footnote.weight(.semibold)).foregroundColor(.secondary).padding(.top, 6)
    }
}
