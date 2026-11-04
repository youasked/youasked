import SwiftUI

/// Resolves the theme from the appearance and the phone's current setting, and hands it down.
struct Themed<Content: View>: View {
    @ObservedObject private var model = YAModel.shared
    @Environment(\.colorScheme) private var scheme
    @ViewBuilder var content: () -> Content
    var body: some View {
        content().environment(\.yaTheme, model.theme(scheme))
    }
}

public extension View {
    /// Adds YouAsked to this view: the floating button, the "it's live" and reply cards, the occasional
    /// nudge, and the sheet itself. Put it once, on your root view.
    ///
    /// - Parameters:
    ///   - trigger: `.floating` adds a launcher button in the corner. `.none` if you use the inline entry
    ///     points (`YAAskBar`, `YARequestButton`…) or your own buttons.
    ///   - position: Which corner the launcher and cards sit in.
    ///   - label: Text next to the launcher icon. Leave nil for an icon-only bubble.
    ///   - offset: Points from the bottom edge, above the safe area. Use it to clear a tab bar.
    ///   - cards: Set false to hide the "it's live", reply and "what's new" cards.
    func youAsked(trigger: LauncherTrigger = .floating, position: LauncherPosition = .bottomTrailing, label: String? = nil,
                  offset: CGFloat = 20, cards: Bool = true) -> some View {
        modifier(YouAskedHost(options: HostOptions(trigger: trigger, position: position, label: label, offset: offset, cards: cards)))
    }
}

/// A container alternative to the modifier: `YouAskedHost { ContentView() }`.
public struct YouAskedHostView<Content: View>: View {
    let content: Content
    let options: HostOptions
    public init(trigger: LauncherTrigger = .floating, position: LauncherPosition = .bottomTrailing, label: String? = nil,
                offset: CGFloat = 20, cards: Bool = true, @ViewBuilder content: () -> Content) {
        self.content = content()
        self.options = HostOptions(trigger: trigger, position: position, label: label, offset: offset, cards: cards)
    }
    public var body: some View { content.modifier(YouAskedHost(options: options)) }
}

struct YouAskedHost: ViewModifier {
    @ObservedObject private var model = YAModel.shared
    @Environment(\.colorScheme) private var scheme
    let options: HostOptions

    func body(content: Content) -> some View {
        content
            .overlay { Themed { overlays } }
            .sheet(isPresented: $model.isPresented, onDismiss: { model.sheetDismissed() }) {
                SheetRoot()
            }
            .onAppear {
                model.host = options
                model.ensureLoaded()
            }
    }

    @ViewBuilder private var overlays: some View {
        if !model.disabled && !model.isPresented {
            ZStack {
                if let n = model.toastNotice, options.cards {
                    CardPlacement(options: options, top: false) {
                        ShippedToast(notice: n, onOpen: {
                            model.markSeen([n.id])
                            model.open(requestId: n.requestId)
                        }, onDismiss: { model.markSeen([n.id]) })
                    }
                    .id(n.id)
                } else if options.cards, model.whatsNewToast, let news = model.whatsNew {
                    CardPlacement(options: options, top: false) {
                        WhatsNewToast(news: news, onOpen: { model.open() }, onDismiss: { model.dismissWhatsNew() })
                    }
                } else if model.nudgeVisible, let s = model.nudgeSettings {
                    CardPlacement(options: options, top: s.position == .top) {
                        NudgeToast(settings: s, appName: model.appName, onOpen: { model.open() }, onDismiss: { model.nudgeDismissed() })
                    }
                }
                if options.trigger == .floating {
                    Launcher(options: options, badge: !model.unseen.isEmpty) { model.open() }
                }
            }
            .animation(.spring(response: 0.42, dampingFraction: 0.75), value: model.toastNotice?.id)
            .animation(.spring(response: 0.42, dampingFraction: 0.75), value: model.nudgeVisible)
        }
    }
}

// MARK: - The sheet

/// What's inside the native sheet: the navigator on the app's background, themed.
struct SheetRoot: View {
    @ObservedObject private var model = YAModel.shared
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let forced: ColorScheme? = {
            switch model.appearance.mode { case .auto: return nil; case .light: return .light; case .dark: return .dark }
        }()
        Themed {
            SheetContent(route: Binding(get: { model.route ?? .home(draft: nil, focus: false, topic: nil, placeholder: nil) },
                                        set: { model.route = $0 }),
                         close: { model.close() })
        }
        .preferredColorScheme(forced)
        .modifier(SheetStyle(radius: model.appearance.radius + 10, background: Theme.resolve(model.appearance, scheme: forced ?? scheme).bg))
    }
}

private struct SheetContent: View {
    @Environment(\.yaTheme) private var t
    @Binding var route: Route
    var close: () -> Void
    var body: some View {
        Navigator(route: $route, onClose: close)
            .background(t.bg.ignoresSafeArea())
            .accessibilityAction(.escape, close)
    }
}

/// Detents, drag indicator, corner radius and background on iOS 16+; a plain sheet on iOS 15.
private struct SheetStyle: ViewModifier {
    var radius: CGFloat
    var background: Color
    @State private var detent: Any = 0

    func body(content: Content) -> some View {
        if #available(iOS 16.4, *) {
            content
                .presentationDetents([.medium, .large], selection: sel)
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(radius)
                .presentationBackground(background)
        } else if #available(iOS 16.0, *) {
            content
                .presentationDetents([.medium, .large], selection: sel)
                .presentationDragIndicator(.visible)
        } else {
            content
        }
    }

    @available(iOS 16.0, *)
    private var sel: Binding<PresentationDetent> {
        Binding(get: { (detent as? PresentationDetent) ?? .large }, set: { detent = $0 })
    }
}

// MARK: - Launcher and cards

private struct CardPlacement<Content: View>: View {
    var options: HostOptions
    var top: Bool
    @ViewBuilder var content: () -> Content
    var body: some View {
        let lift: CGFloat = options.trigger == .floating ? 68 : 0
        VStack {
            if !top { Spacer(minLength: 0) }
            HStack {
                if options.position == .bottomTrailing { Spacer(minLength: 0) }
                content().frame(maxWidth: 400)
                if options.position == .bottomLeading { Spacer(minLength: 0) }
            }
            .padding(.horizontal, 16)
            .padding(top ? .top : .bottom, top ? 8 : options.offset + lift)
            if top { Spacer(minLength: 0) }
        }
        .transition(.move(edge: top ? .top : .bottom).combined(with: .opacity))
    }
}

struct Launcher: View {
    @Environment(\.yaTheme) private var t
    var options: HostOptions
    var badge: Bool
    var action: () -> Void
    @State private var shown = false

    var body: some View {
        VStack {
            Spacer(minLength: 0)
            HStack {
                if options.position == .bottomTrailing { Spacer(minLength: 0) }
                Button(action: action) {
                    HStack(spacing: 8) {
                        IconIdea(color: t.accentFg, size: 26, ink: t.accent)
                        if let label = options.label, !label.isEmpty { Text(label).ya(15, .bold, .accentFg).lineLimit(1) }
                    }
                    .padding(.horizontal, options.label?.isEmpty == false ? 18 : 15)
                    .frame(minWidth: 56, minHeight: 56)
                    .background(Capsule().fill(t.accent))
                    .overlay(alignment: .topTrailing) {
                        if badge { Circle().fill(Color(red: 1, green: 0.231, blue: 0.188)).frame(width: 10, height: 10).overlay(Circle().stroke(t.accent, lineWidth: 2)).padding(3) }
                    }
                    .shadow(color: .black.opacity(0.3), radius: 14, y: 8)
                }
                .buttonStyle(TapStyle())
                .accessibilityLabel(options.label?.isEmpty == false ? options.label! : "Feature requests")
                .accessibilityHint(badge ? "You have something new" : "Opens feature requests")
                if options.position == .bottomLeading { Spacer(minLength: 0) }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, options.offset)
        }
        .scaleEffect(shown ? 1 : 0.01)
        .opacity(shown ? 1 : 0)
        .onAppear { withAnimation(.spring(response: 0.45, dampingFraction: 0.6)) { shown = true } }
    }
}

private struct ToastShell<Content: View>: View {
    @Environment(\.yaTheme) private var t
    var kicker: String
    var onDismiss: () -> Void
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text(kicker).ya(12.5, .semibold, .muted, style: .caption)
                Spacer(minLength: 0)
                Tap(label: "Dismiss", action: onDismiss) { IconClose(color: t.muted, size: 18).frame(width: 30, height: 30) }
                    .padding(-4)
            }
            content()
        }
        .padding(16).padding(.bottom, -2)
        .background(
            RoundedRectangle(cornerRadius: t.radius + 6, style: .continuous).fill(t.bg)
                .overlay(RoundedRectangle(cornerRadius: t.radius + 6, style: .continuous).stroke(t.border, lineWidth: 1))
                .shadow(color: .black.opacity(0.25), radius: 24, y: 12)
        )
        .accessibilityElement(children: .contain)
    }
}

private struct ToastActions: View {
    var primary: String
    var secondary: String
    var onPrimary: () -> Void
    var onSecondary: () -> Void
    var body: some View {
        HStack(spacing: 8) {
            YAButton(label: primary, small: true, action: onPrimary)
            YAButton(label: secondary, small: true, ghost: true, action: onSecondary)
        }
        .padding(.top, 12)
    }
}

struct ShippedToast: View {
    @Environment(\.yaTheme) private var t
    var notice: Notice
    var onOpen: () -> Void
    var onDismiss: () -> Void
    var body: some View {
        let reply = notice.kind == "reply"
        ToastShell(kicker: reply ? "New reply about" : "You asked for", onDismiss: onDismiss) {
            Text(notice.title).ya(17, .heavy, style: .headline, tracking: -0.2, line: 22).padding(.top, 3)
            if reply {
                Text(notice.reply ?? "").ya(13.5, .regular, .fg, line: 19).lineLimit(3).padding(.top, 6)
            } else {
                HStack(spacing: 6) {
                    IconCheck(color: t.green, size: 15)
                    Text("It's live").ya(14, .bold, .green)
                }
                .padding(.top, 8)
                if let note = notice.shipNote, !note.isEmpty { Text(note).ya(13.5, .regular, .muted, line: 19).padding(.top, 6) }
            }
            ToastActions(primary: reply ? "Reply" : "See it", secondary: reply ? "Later" : "Nice", onPrimary: onOpen, onSecondary: onDismiss)
        }
        .onAppear { Haptic.success() }
        .accessibilityAddTraits(.isModal)
    }
}

struct WhatsNewToast: View {
    @Environment(\.yaTheme) private var t
    var news: WhatsNew
    var onOpen: () -> Void
    var onDismiss: () -> Void
    var body: some View {
        let mine = news.items.contains { $0.mine }
        ToastShell(kicker: "What's new", onDismiss: onDismiss) {
            Text(whatsNewHeading(news.total)).ya(17, .heavy, style: .headline, tracking: -0.2, line: 22).padding(.top, 3)
            if mine {
                HStack(spacing: 6) {
                    IconCheck(color: t.green, size: 15)
                    Text("Including something you asked for").ya(14, .bold, .green)
                }
                .padding(.top, 8)
            }
            ToastActions(primary: "See what's new", secondary: "Not now", onPrimary: onOpen, onSecondary: onDismiss)
        }
        .onAppear { if mine { Haptic.success() } }
    }
}

/// "Got an idea for <App>?": the occasional prompt, tuned in the dashboard.
struct NudgeToast: View {
    @Environment(\.yaTheme) private var t
    var settings: NudgeSettings
    var appName: String
    var onOpen: () -> Void
    var onDismiss: () -> Void
    var body: some View {
        ToastShell(kicker: "Help shape \(appName)", onDismiss: onDismiss) {
            HStack(alignment: .center, spacing: 12) {
                IconIdea(color: t.accent, size: 20, ink: t.bg)
                    .frame(width: 36, height: 36)
                    .background(RoundedRectangle(cornerRadius: 11, style: .continuous).fill(t.tint))
                VStack(alignment: .leading, spacing: 2) {
                    Text(settings.message ?? "Got an idea for \(appName)?").ya(17, .heavy, style: .headline, tracking: -0.2, line: 22)
                    Text("Ask for a feature or vote on what others want.").ya(13.5, .regular, .muted, line: 19)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.top, 6)
            ToastActions(primary: "Share an idea", secondary: "Not now", onPrimary: onOpen, onSecondary: onDismiss)
        }
    }
}
