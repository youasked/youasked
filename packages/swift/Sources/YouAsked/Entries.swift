import SwiftUI

// Inline entry points. Each renders inside your layout and opens the same sheet.
// They render nothing while the app is in test mode for this build. Put `.youAsked()` on your root view too,
// so there is a sheet to open.

/// A chat-style input bar. Tapping it opens the composer. Good at the top of a home screen or under an empty state.
public struct YAAskBar: View {
    @ObservedObject private var model = YAModel.shared
    let placeholder: String
    public init(placeholder: String = "Ask for a feature…") { self.placeholder = placeholder }
    public var body: some View {
        Themed { Inner(placeholder: placeholder) }
    }
    private struct Inner: View {
        @ObservedObject private var model = YAModel.shared
        @Environment(\.yaTheme) private var t
        let placeholder: String
        var body: some View {
            if !model.disabled {
                Tap(label: placeholder, action: { model.open(view: .new) }) {
                    HStack(spacing: 12) {
                        if model.appIcon != nil {
                            AppAvatar(icon: model.appIcon, size: 30)
                        } else {
                            IconIdea(color: t.accent, size: 18, ink: t.bg)
                                .frame(width: 30, height: 30)
                                .background(Circle().fill(t.tint))
                        }
                        Text(placeholder).ya(15.5, .regular, .muted).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                        if !model.unseen.isEmpty { Badge(count: model.unseen.count) }
                        IconSend(color: t.accentFg, size: 17).frame(width: 34, height: 34).background(Circle().fill(t.accent))
                    }
                    .padding(.vertical, 8).padding(.leading, 10).padding(.trailing, 8)
                    .background(RoundedRectangle(cornerRadius: t.buttonRadius ?? 999, style: .continuous).fill(t.bg))
                    .overlay(RoundedRectangle(cornerRadius: t.buttonRadius ?? 999, style: .continuous).stroke(t.border, lineWidth: 1))
                }
                .onAppear { model.ensureLoaded() }
            }
        }
    }
}

/// A card with the top requests and vote buttons, for a dashboard or home tab.
public struct YAFeatureCard: View {
    let heading: String, description: String, limit: Int
    public init(heading: String = "Shape what's next", description: String = "Vote on ideas or suggest your own", limit: Int = 3) {
        self.heading = heading; self.description = description; self.limit = limit
    }
    public var body: some View { Themed { Inner(heading: heading, description: description, limit: limit) } }

    private struct Inner: View {
        @ObservedObject private var model = YAModel.shared
        @Environment(\.yaTheme) private var t
        let heading: String, description: String, limit: Int
        @State private var rows: [FeatureRequest]?
        var body: some View {
            if !model.disabled {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 12) {
                        IconIdea(color: t.accent, size: 20, ink: t.bg)
                            .frame(width: 36, height: 36)
                            .background(RoundedRectangle(cornerRadius: 11, style: .continuous).fill(t.tint))
                        VStack(alignment: .leading, spacing: 1) {
                            Text(heading).ya(16, .bold, style: .headline, tracking: -0.1)
                            Text(description).ya(13, .regular, .muted, style: .footnote)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if let notice = model.config?.unseen.first(where: { $0.kind == "shipped" }) {
                        Tap(action: { model.markSeen([notice.id]); model.open(requestId: notice.requestId) }) {
                            HStack(spacing: 10) {
                                GreenDot()
                                rich(("You asked for ", false), (notice.title, true), (". It's live.", false)).ya(14, line: 19)
                                    .multilineTextAlignment(.leading).frame(maxWidth: .infinity, alignment: .leading)
                                IconChevron(color: t.muted, size: 16)
                            }
                            .padding(.vertical, 10).padding(.horizontal, 12)
                            .background(RoundedRectangle(cornerRadius: t.radius, style: .continuous).fill(t.greenTint))
                        }
                    }
                    if let rows {
                        if !rows.isEmpty {
                            VStack(spacing: 8) {
                                ForEach(rows.prefix(limit)) { r in
                                    RequestRow(client: model.client, request: r, compact: true, onOpen: { model.open(requestId: r.id) })
                                }
                            }
                        }
                    } else {
                        Skeleton(rows: 2)
                    }
                    HStack(spacing: 8) {
                        YAButton(label: "Suggest an idea", small: true, fill: true) { model.open(view: .new) }
                        if let rows, rows.count > limit {
                            YAButton(label: "See all \(rows.count)", small: true, ghost: true, fill: true) { model.open(view: .board) }
                        }
                    }
                }
                .padding(16)
                .background(RoundedRectangle(cornerRadius: t.radius + 6, style: .continuous).fill(t.bg))
                .task {
                    model.ensureLoaded()
                    rows = try? await model.client.list(sort: "top", status: "active")
                    if rows == nil { rows = [] }
                }
            }
        }
    }
}

/// A button for your own toolbar or menu.
public struct YARequestButton: View {
    public enum Variant: Sendable {
        /// A tinted pill with an icon and label.
        case pill
        /// A round icon button, e.g. in a header.
        case icon
        /// A settings-style row with a chevron.
        case row
    }
    let variant: Variant, label: String, sublabel: String?
    public init(_ variant: Variant = .pill, label: String = "Request a feature", sublabel: String? = "Vote on what we build next") {
        self.variant = variant; self.label = label; self.sublabel = sublabel
    }
    public var body: some View { Themed { Inner(variant: variant, label: label, sublabel: sublabel) } }

    private struct Inner: View {
        @ObservedObject private var model = YAModel.shared
        @Environment(\.yaTheme) private var t
        let variant: Variant, label: String, sublabel: String?
        var body: some View {
            if !model.disabled {
                Group {
                    switch variant {
                    case .icon:
                        Tap(label: label, action: { model.open() }) {
                            IconIdea(color: t.fg, size: 22, ink: t.bg)
                                .frame(width: 40, height: 40)
                                .background(Circle().fill(t.surface))
                                .overlay(alignment: .topTrailing) {
                                    if !model.unseen.isEmpty { Circle().fill(Color(red: 1, green: 0.231, blue: 0.188)).frame(width: 10, height: 10).overlay(Circle().stroke(t.bg, lineWidth: 2)).padding(3) }
                                }
                        }
                    case .row:
                        Tap(action: { model.open() }) {
                            HStack(spacing: 12) {
                                IconIdea(color: t.accent, size: 18, ink: t.bg)
                                    .frame(width: 32, height: 32)
                                    .background(RoundedRectangle(cornerRadius: 11, style: .continuous).fill(t.tint))
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(label).ya(15.5, .semibold)
                                    if let sublabel, !sublabel.isEmpty { Text(sublabel).ya(13, .regular, .muted, style: .footnote) }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                if !model.unseen.isEmpty { Badge(count: model.unseen.count) }
                                IconChevron(color: t.muted, size: 17)
                            }
                            .padding(.vertical, 12).padding(.horizontal, 14)
                            .background(RoundedRectangle(cornerRadius: t.radius, style: .continuous).fill(t.bg))
                        }
                        .accessibilityLabel(label)
                    case .pill:
                        Tap(action: { model.open() }) {
                            HStack(spacing: 8) {
                                IconIdea(color: t.accent, size: 18, ink: t.bg)
                                Text(label).ya(14.5, .bold, .accent)
                                if !model.unseen.isEmpty { Badge(count: model.unseen.count) }
                            }
                            .padding(.leading, 13).padding(.trailing, 16).frame(height: 40)
                            .background(RoundedRectangle(cornerRadius: t.buttonRadius ?? 999, style: .continuous).fill(t.tint))
                        }
                        .accessibilityLabel(label)
                    }
                }
                .onAppear { model.ensureLoaded() }
            }
        }
    }
}

/// A quiet line next to a feature: "Want more from charts?". Opens the composer already about that
/// topic, and the request is saved with it so you can see which feature people are asking about.
public struct YAAskAbout: View {
    let topic: String, prompt: String?
    public init(topic: String, prompt: String? = nil) { self.topic = topic; self.prompt = prompt }
    public var body: some View { Themed { Inner(topic: topic, prompt: prompt) } }
    private struct Inner: View {
        @ObservedObject private var model = YAModel.shared
        @Environment(\.yaTheme) private var t
        let topic: String, prompt: String?
        var body: some View {
            if !model.disabled {
                Tap(action: { model.open(topic: topic) }) {
                    HStack(spacing: 6) {
                        IconIdea(color: t.accent, size: 15, ink: t.bg)
                        Text(prompt ?? "Want more from \(topic)?").ya(13.5, .regular, .muted, style: .footnote)
                    }
                    .padding(.vertical, 2)
                }
                .onAppear { model.ensureLoaded() }
            }
        }
    }
}

/// For an empty search: "Can't find “export”? Ask for it". Opens the composer with the search as the
/// draft, tagged as a search so you can tell what people looked for and didn't find.
public struct YAAskForIt: View {
    let query: String
    public init(query: String) { self.query = query }
    public var body: some View { Themed { Inner(query: query) } }
    private struct Inner: View {
        @ObservedObject private var model = YAModel.shared
        @Environment(\.yaTheme) private var t
        let query: String
        var body: some View {
            if !model.disabled {
                let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
                let shown = q.count > 40 ? String(q.prefix(39)).trimmingCharacters(in: .whitespaces) + "…" : q
                Tap(action: { model.open(view: .new, draft: q, topic: "search") }) {
                    HStack(spacing: 8) {
                        Text(shown.isEmpty ? "Can't find it?" : "Can't find “\(shown)”?").ya(14.5, .regular, .muted).lineLimit(2)
                        HStack(spacing: 0) {
                            Text("Ask for it").ya(14.5, .bold, .accent)
                            IconChevron(color: t.accent, size: 16)
                        }
                        .padding(.vertical, 3).padding(.leading, 12).padding(.trailing, 6)
                        .background(RoundedRectangle(cornerRadius: t.buttonRadius ?? 999, style: .continuous).fill(t.tint))
                    }
                    .padding(.vertical, 4)
                }
                .onAppear { model.ensureLoaded() }
            }
        }
    }
}

/// The whole experience inline, for a settings screen or a tab. Fills its parent unless you give it a height.
public struct YAFeatureBoard: View {
    public enum Start: Sendable { case home, board }
    let start: Start, height: CGFloat?
    public init(start: Start = .home, height: CGFloat? = nil) { self.start = start; self.height = height }
    public var body: some View { Themed { Inner(start: start, height: height) } }
    private struct Inner: View {
        @ObservedObject private var model = YAModel.shared
        @Environment(\.yaTheme) private var t
        let start: Start, height: CGFloat?
        @State private var route: Route = .home(draft: nil, focus: false, topic: nil, placeholder: nil)
        @State private var set = false
        var body: some View {
            if !model.disabled {
                Navigator(route: $route, onClose: nil)
                    .frame(maxWidth: .infinity)
                    .frame(height: height)
                    .frame(maxHeight: height == nil ? .infinity : nil)
                    .background(t.bg)
                    .clipShape(RoundedRectangle(cornerRadius: t.radius + 6, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: t.radius + 6, style: .continuous).stroke(t.border, lineWidth: 1))
                    .onAppear {
                        model.ensureLoaded()
                        if !set { set = true; if start == .board { route = .board(tab: nil) } }
                    }
            }
        }
    }
}
