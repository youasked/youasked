import SwiftUI

/// Renders the current screen. Shared by the sheet and the embedded board.
struct Navigator: View {
    @Binding var route: Route
    var onClose: (() -> Void)?

    var body: some View {
        let nav = Nav(go: { r in route = r }, close: onClose)
        Group {
            switch route {
            case .home(let draft, let focus, let topic, let placeholder):
                HomeView(draft: draft, focus: focus, topic: topic, placeholder: placeholder, nav: nav)
            case .board(let tab):
                BoardView(initialTab: tab, nav: nav)
            case .detail(let id, let from):
                DetailView(id: id, from: from, nav: nav)
            case .mine:
                MineView(nav: nav)
            }
        }
        .id(route.key)
        .modifier(FadeIn())
    }
}

// MARK: - Full board

private struct BoardTabSpec {
    let key: BoardTab, label: String, sort: String, status: String
}
private let boardTabs = [
    BoardTabSpec(key: .top, label: "Top", sort: "top", status: "active"),
    BoardTabSpec(key: .new, label: "New", sort: "new", status: "active"),
    BoardTabSpec(key: .shipped, label: "Shipped", sort: "new", status: "shipped"),
]

struct BoardView: View {
    @Environment(\.yaTheme) private var t
    @ObservedObject private var model = YAModel.shared
    let nav: Nav
    @State private var tab: BoardTab

    init(initialTab: BoardTab?, nav: Nav) {
        self.nav = nav
        _tab = State(initialValue: initialTab ?? .top)
    }

    var body: some View {
        let spec = boardTabs.first { $0.key == tab } ?? boardTabs[0]
        VStack(spacing: 0) {
            YAHeader(title: model.title, onBack: { nav.go(.home(draft: nil, focus: false, topic: nil, placeholder: nil)) }, onClose: nav.close,
                     leading: { EmptyView() }, trailing: { LinkButton(label: "Yours") { nav.go(.mine) } })
            HStack(spacing: 2) {
                ForEach(boardTabs, id: \.key) { s in
                    let on = s.key == tab
                    Button { tab = s.key } label: {
                        Text(s.label).ya(14, .semibold, on ? .fg : .muted)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 7)
                            .background(
                                RoundedRectangle(cornerRadius: max(t.radius - 5, 6), style: .continuous)
                                    .fill(on ? t.bg : Color.clear)
                                    .shadow(color: .black.opacity(on ? 0.10 : 0), radius: 1.5, y: 1)
                            )
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(TapStyle(scale: false))
                    .accessibilityAddTraits(on ? [.isSelected, .isButton] : .isButton)
                }
            }
            .padding(3)
            .background(RoundedRectangle(cornerRadius: t.radius - 2, style: .continuous).fill(t.surface))
            .padding(.horizontal, 16).padding(.bottom, 8)
            .animation(.easeOut(duration: 0.15), value: tab)
            RequestList(spec: spec, nav: nav, from: .board)
                .id(spec.key)
            RequestFooter(nav: nav)
        }
    }
}

private struct RequestList: View {
    @Environment(\.yaTheme) private var t
    let spec: BoardTabSpec?
    var mine = false
    let nav: Nav
    let from: Route.From
    @StateObject private var load: Loader<[FeatureRequest]>

    init(spec: BoardTabSpec?, mine: Bool = false, nav: Nav, from: Route.From) {
        self.spec = spec; self.mine = mine; self.nav = nav; self.from = from
        let client = YAModel.shared.client
        _load = StateObject(wrappedValue: Loader {
            mine ? try await client.mine() : try await client.list(sort: spec?.sort ?? "top", status: spec?.status ?? "active")
        })
    }

    var body: some View {
        let isShipped = spec?.key == .shipped
        Group {
            if let e = load.error, load.data == nil {
                ScrollView { EmptyState(title: mine ? "Couldn't load your requests" : "Couldn't load requests", message: errorText(e)) }
            } else if let data = load.data {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        if data.isEmpty {
                            if mine {
                                EmptyState(title: "Nothing yet", message: "Requests you post or vote on show up here, with their status.")
                            } else {
                                EmptyState(title: isShipped ? "Nothing shipped yet" : "No requests yet",
                                           message: isShipped ? "Requests show up here once they're live." : "Tell us what you'd like next. Others can vote on it.")
                            }
                        }
                        ForEach(data) { r in
                            RequestRow(client: YAModel.shared.client, request: r, onOpen: { nav.go(.detail(id: r.id, from: from)) })
                        }
                    }
                    .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 18)
                }
                .refreshable { await load.run() }
            } else {
                ScrollView { Skeleton().padding(.horizontal, 16).padding(.top, 6) }
            }
        }
        .frame(maxHeight: .infinity)
    }
}

struct RequestFooter: View {
    @Environment(\.yaTheme) private var t
    let nav: Nav
    var body: some View {
        YAButton(label: "Request a feature", icon: AnyView(IconPlus(color: t.accentFg)), fill: true) {
            nav.go(.home(draft: nil, focus: true, topic: nil, placeholder: nil))
        }
        .padding(.top, 12).padding(.horizontal, 16).padding(.bottom, 12)
        .background(t.bg.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Rectangle().fill(t.border).frame(height: 0.5) }
    }
}

// MARK: - Yours

struct MineView: View {
    let nav: Nav
    var body: some View {
        VStack(spacing: 0) {
            YAHeader(title: "Your requests", onBack: { nav.go(.board(tab: nil)) }, onClose: nav.close)
            RequestList(spec: nil, mine: true, nav: nav, from: .mine)
            RequestFooter(nav: nav)
        }
    }
}

// MARK: - One request

struct DetailView: View {
    @Environment(\.yaTheme) private var t
    @ObservedObject private var model = YAModel.shared
    let id: String
    let from: Route.From?
    let nav: Nav

    @StateObject private var load: Loader<RequestDetail>
    @State private var detail: RequestDetail?
    @State private var reply = ""
    @State private var focused = false
    @State private var sending = false
    @State private var replyError: String?
    @State private var voted: Bool?
    @State private var early = false
    @State private var confirmDelete = false
    @State private var deleting = false
    @State private var deleteError: String?

    init(id: String, from: Route.From?, nav: Nav) {
        self.id = id; self.from = from; self.nav = nav
        let client = YAModel.shared.client
        _load = StateObject(wrappedValue: Loader { try await client.get(id) })
    }

    private var request: FeatureRequest? { detail?.request }
    private var comments: [RequestComment] { detail?.comments ?? [] }

    var body: some View {
        VStack(spacing: 0) {
            YAHeader(title: "", onBack: { nav.go(from.map(back) ?? .board(tab: nil)) }, onClose: nav.close)
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) { content; Color.clear.frame(height: 1).id("end") }
                        .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 18)
                }
                .dismissKeyboardOnScroll()
                .onValueChange(of: comments.count) { _ in
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) { withAnimation { proxy.scrollTo("end", anchor: .bottom) } }
                }
            }
            if request != nil {
                VStack(alignment: .leading, spacing: 0) {
                    Composer(text: $reply, placeholder: "Message", label: "Message", sendLabel: "Send comment", maxLength: 1000,
                             canSend: !reply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !sending, focused: $focused, onSend: send)
                    if let replyError { Text(replyError).ya(13.5, .regular, .muted, line: 19).padding(.top, 10) }
                }
                .padding(.horizontal, 12).padding(.top, 8).padding(.bottom, 10)
                .background(t.bg.ignoresSafeArea(edges: .bottom))
            }
        }
        .onValueChange(of: load.data?.request?.id) { _ in adopt() }
        .onAppear { adopt() }
        .onValueChange(of: model.config?.unseen.count ?? 0) { _ in refreshForNotice() }
    }

    private func back(_ f: Route.From) -> Route {
        switch f {
        case .home: return .home(draft: nil, focus: false, topic: nil, placeholder: nil)
        case .board: return .board(tab: nil)
        case .mine: return .mine
        }
    }

    private func adopt() {
        guard let d = load.data, detail == nil || detail?.request?.id != d.request?.id else { return }
        detail = d
        early = d.earlyAccess ?? false
        if let r = d.redirect { nav.go(.detail(id: r, from: nil)) }
        // Opening a request someone was told about counts as seeing it.
        let here = model.config?.unseen.filter { $0.requestId == id }.map(\.id) ?? []
        if !here.isEmpty { model.markSeen(here) }
    }

    /// A reply that lands while you're reading shows up in the thread.
    private func refreshForNotice() {
        guard request != nil else { return }
        Task { if let d = try? await model.client.get(id) { detail = d } }
    }

    @ViewBuilder private var content: some View {
        if let e = load.error, request == nil {
            EmptyState(title: e == "not_found" ? "This request was removed." : "Couldn't load this request", message: e == "not_found" ? nil : errorText(e))
        } else if let request {
            HStack(spacing: 8) {
                if request.status != .open { StatusPill(status: request.status) }
                Text("YA-\(request.number)").ya(12, .semibold, .muted, style: .caption, tracking: 0.3)
            }
            Text(request.title).ya(21, .bold, style: .title3, tracking: -0.3, line: 27)
                .padding(.top, 10).padding(.bottom, 8)
                .accessibilityAddTraits(.isHeader)
            if !request.body.isEmpty && request.body != request.title { Text(request.body).ya(15, line: 21) }
            ForEach(detail?.attachments ?? [], id: \.id) { a in
                AsyncImage(url: URL(string: a.url)) { phase in
                    if let img = phase.image { img.resizable().scaledToFill() } else { t.surface }
                }
                .frame(maxWidth: .infinity).frame(height: 200)
                .clipShape(RoundedRectangle(cornerRadius: t.radius, style: .continuous))
                .padding(.top, 12)
                .accessibilityLabel("Screenshot attached to this request")
            }
            BigVote(client: model.client, request: request) { voted = $0 }
            if (request.status == .planned || request.status == .inProgress) && (voted ?? request.voted) {
                earlyAccessRow
            }
            if request.mine && request.status != .shipped {
                Text("You asked for this. We'll tell you here when it ships.").ya(13.5, .regular, .muted, line: 19).padding(.top, 10)
            }
            if detail?.canDelete == true { deleteSection(request) }
            if let deleteError { Text(deleteError).ya(13.5, .regular, .muted, line: 19).padding(.top, 10) }
            if request.status == .shipped {
                HStack(alignment: .top, spacing: 10) {
                    GreenDot(size: 20)
                    rich(("It's live.", true), (request.shipNote.map { " \($0)" } ?? " Thanks for asking.", false),
                         (request.creditName.map { "\nThanks to \($0) for asking." } ?? "", false)).ya(14, line: 20)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.vertical, 12).padding(.horizontal, 14)
                .background(RoundedRectangle(cornerRadius: t.radius, style: .continuous).fill(t.greenTint))
                .padding(.top, 14)
                .accessibilityElement(children: .combine)
            }
            Text("Conversation").ya(13, .semibold, .muted, style: .footnote).padding(.top, 26).padding(.bottom, 6).accessibilityAddTraits(.isHeader)
            if comments.isEmpty {
                Text("No messages yet. Add details or ask a question below.").ya(15, .regular, .muted, line: 21)
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(comments) { c in MessageView(comment: c, appName: model.appName, appIcon: model.appIcon) }
                }
                .padding(.top, 8)
            }
        } else {
            Skeleton()
        }
    }

    private var earlyAccessRow: some View {
        Tap(scale: false, action: toggleEarly) {
            HStack(spacing: 12) {
                IconSpark(color: early ? t.accentFg : t.accent, size: 17)
                    .frame(width: 32, height: 32)
                    .background(RoundedRectangle(cornerRadius: 11, style: .continuous).fill(early ? t.accent : t.tint))
                VStack(alignment: .leading, spacing: 0) {
                    Text("Try it early").ya(15.5, .semibold)
                    Text(early ? "You're on the list. We'll let you in first." : "Get access before everyone else").ya(13, .regular, .muted, style: .footnote).multilineTextAlignment(.leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                MiniToggle(on: early)
            }
            .padding(.vertical, 10).padding(.leading, 12).padding(.trailing, 14)
            .background(RoundedRectangle(cornerRadius: t.radius, style: .continuous).fill(t.surface))
        }
        .padding(.top, 12)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Try it early")
        .accessibilityValue(early ? "On" : "Off")
        .accessibilityAddTraits(.isButton)
    }

    @ViewBuilder private func deleteSection(_ request: FeatureRequest) -> some View {
        if confirmDelete {
            VStack(alignment: .leading, spacing: 6) {
                Text("Delete this request? This can't be undone.").ya(13.5, .regular, .muted, line: 19)
                HStack(spacing: 16) {
                    Tap(action: { remove(request) }) { Text(deleting ? "Deleting…" : "Delete").ya(14, .semibold, .red).padding(.vertical, 4) }.disabled(deleting)
                    Tap(action: { confirmDelete = false }) { Text("Keep it").ya(14, .semibold, .accent).padding(.vertical, 4) }.disabled(deleting)
                }
            }
            .padding(.top, 10)
        } else {
            Tap(action: { confirmDelete = true }) { Text("Delete my request").ya(14, .medium, .muted).padding(.vertical, 4) }
                .padding(.top, 10)
        }
    }

    private func toggleEarly() {
        guard let r = request else { return }
        let before = early
        Haptic.light()
        early.toggle()
        Task {
            do { early = try await model.client.earlyAccess(r.id) } catch { early = before }
        }
    }

    private func remove(_ r: FeatureRequest) {
        guard !deleting else { return }
        deleting = true; deleteError = nil
        Task {
            do {
                try await model.client.remove(r.id)
                Haptic.light()
                nav.go(.mine)
            } catch {
                let e = error as? YouAskedError
                deleteError = errorText(e?.code ?? "network", detail: e?.detail)
                deleting = false
            }
        }
    }

    private func send() {
        let body = reply.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty, !sending, var r = request else { return }
        sending = true; replyError = nil
        Task {
            do {
                let c = try await model.client.comment(r.id, body: body)
                r.comments += 1
                var d = detail ?? RequestDetail()
                d.comments = comments + [c]
                d.request = r
                detail = d
                reply = ""
                Haptic.light()
            } catch {
                replyError = errorText((error as? YouAskedError)?.code ?? "network")
            }
            sending = false
        }
    }
}

/// Team replies read as messages from the app, yours sit on the right like any chat.
struct MessageView: View {
    @Environment(\.yaTheme) private var t
    let comment: RequestComment
    let appName: String
    let appIcon: AppIcon?

    var body: some View {
        if comment.mine {
            VStack(alignment: .trailing, spacing: 3) {
                bubble(.out)
                Text(ago(comment.createdAt)).ya(12, .regular, .muted, style: .caption).padding(.horizontal, 4)
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
            .padding(.leading, 28)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("You, \(ago(comment.createdAt)): \(comment.body)")
        } else {
            HStack(alignment: .bottom, spacing: 8) {
                if comment.team && appIcon != nil { AppAvatar(icon: appIcon, size: 26, round: true) }
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(comment.team ? appName : (comment.author?.nilIfEmpty ?? "Someone")).ya(12, .bold, style: .caption)
                        if comment.team {
                            Text("Team").ya(11, .bold, .accentFg, style: .caption2)
                                .padding(.vertical, 1).padding(.horizontal, 7)
                                .background(Capsule().fill(t.accent))
                        }
                        Text(ago(comment.createdAt)).ya(12, .regular, .muted, style: .caption)
                    }
                    .padding(.horizontal, 4)
                    bubble(.in)
                }
                Spacer(minLength: 20)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(comment.team ? "\(appName) team" : (comment.author ?? "Someone")), \(ago(comment.createdAt)): \(comment.body)")
        }
    }

    private func bubble(_ tone: BubbleTone) -> some View {
        Text(comment.body).ya(15, .regular, tone == .out ? .accentFg : .fg, line: 21)
            .padding(.vertical, 10).padding(.horizontal, 14)
            .background(CornerShape(20, bl: tone == .out ? 20 : 6, br: tone == .out ? 6 : 20).fill(tone == .out ? t.accent : t.surface))
    }
}
