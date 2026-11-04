import SwiftUI
import UIKit

/// Navigation actions handed to each screen.
struct Nav {
    var go: (Route) -> Void
    var close: (() -> Void)?
}

// MARK: - Bubbles

enum BubbleTone { case `in`, out, win, error }

struct Bubble<Content: View>: View {
    @Environment(\.yaTheme) private var t
    var tone: BubbleTone = .in
    var stretch = false
    var maxFull = false
    @ViewBuilder var content: () -> Content
    @State private var shown = false

    var body: some View {
        let fill: Color = {
            switch tone {
            case .in: return t.surface
            case .out: return t.accent
            case .win: return t.greenTint
            case .error: return t.redTint
            }
        }()
        let shape = CornerShape(20, bl: tone == .out ? 20 : 6, br: tone == .out ? 6 : 20)
        let bubble = VStack(alignment: .leading, spacing: 6, content: content)
            .padding(.vertical, 10).padding(.horizontal, 14)
            .frame(maxWidth: stretch ? .infinity : nil, alignment: .leading)
            .background(shape.fill(fill))
            .scaleEffect(shown ? 1 : 0.92)
            .opacity(shown ? 1 : 0)
            .onAppear { withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) { shown = true } }
        if stretch || maxFull {
            bubble
        } else if tone == .out {
            HStack(spacing: 0) { Spacer(minLength: 48); bubble }
        } else {
            HStack(spacing: 0) { bubble; Spacer(minLength: 48) }
        }
    }
}

struct BubbleLink: View {
    var label: String
    var action: () -> Void
    var body: some View {
        Tap(action: action) { Text(label).ya(14, .bold, .accent).padding(.vertical, 2) }
    }
}

struct ReplyBubble: View {
    @Environment(\.yaTheme) private var t
    var notice: Notice
    var appName: String
    var onOpen: () -> Void
    var body: some View {
        Bubble {
            Text("\(appName) replied about \(notice.title)").ya(12.5, .semibold, .muted, style: .caption)
            Text(notice.reply ?? "").ya(15, line: 21)
            BubbleLink(label: "Reply", action: onOpen)
        }
    }
}

/// A short burst from the corner of a bubble when something they asked for has shipped.
struct Confetti: View {
    @Environment(\.yaTheme) private var t
    @State private var p: CGFloat = 0

    private func piece(_ i: Int, _ colors: [Color]) -> some View {
        let angle = Double.pi * (0.15 + Double(i) / 13 * 0.7)
        let dist = CGFloat(38 + (i % 4) * 14)
        let sign: CGFloat = i % 2 == 1 ? -1 : 1
        let x: CGFloat = CGFloat(cos(angle)) * dist * sign
        let y: CGFloat = -CGFloat(sin(angle)) * dist
        let spin: Double = Double((i * 67) % 360) * Double(p)
        let fade: Double = p < 0.1 ? Double(p) * 10 : (p < 0.7 ? 1 : Double((1 - p) / 0.3))
        return RoundedRectangle(cornerRadius: 2)
            .fill(colors[i % colors.count])
            .frame(width: 6, height: 9)
            .rotationEffect(.degrees(spin))
            .offset(x: x * p, y: (y + 24) * p)
            .opacity(fade)
    }

    var body: some View {
        let colors: [Color] = [t.accent, t.green, t.amber, Color(red: 1, green: 0.49, blue: 0.7)]
        ZStack {
            ForEach(0..<14, id: \.self) { i in piece(i, colors) }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear { withAnimation(.easeOut(duration: 0.95)) { p = 1 } }
    }
}

struct TypingBubble: View {
    @Environment(\.yaTheme) private var t
    @State private var phase = false
    var body: some View {
        Bubble {
            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { i in
                    Circle().fill(t.muted).frame(width: 7, height: 7)
                        .opacity(phase ? 1 : 0.3)
                        .animation(.easeInOut(duration: 0.35).repeatForever(autoreverses: true).delay(Double(i) * 0.15), value: phase)
                }
            }
            .padding(.vertical, 4).padding(.horizontal, 2)
        }
        .onAppear { phase = true }
        .accessibilityLabel("Sending")
    }
}

// MARK: - Home

enum ThreadItem: Identifiable {
    case out(id: Int, text: String, images: [UIImage])
    case typing(id: Int)
    case posted(id: Int, request: FeatureRequest)
    case reply(id: Int, notice: Notice)
    case error(id: Int, text: String)
    var id: Int {
        switch self {
        case .out(let id, _, _), .typing(let id), .posted(let id, _), .reply(let id, _), .error(let id, _): return id
        }
    }
    var isTyping: Bool { if case .typing = self { return true } else { return false } }
}

/// Long messages keep their first line or sentence as the title and the full text as details.
func splitMessage(_ text: String) -> (title: String, body: String) {
    let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if t.count <= 120 && !t.contains("\n") { return (t, "") }
    let first = t.components(separatedBy: "\n").first ?? t
    var title = String(first.prefix(120))
    if let re = try? NSRegularExpression(pattern: "^(.{12,120}?[.!?])\\s"),
       let m = re.firstMatch(in: first, range: NSRange(first.startIndex..., in: first)), m.numberOfRanges > 1,
       let r = Range(m.range(at: 1), in: first) {
        title = String(first[r].prefix(120))
    }
    return (title.trimmingCharacters(in: .whitespaces), t)
}

struct HomeView: View {
    @Environment(\.yaTheme) private var t
    @ObservedObject private var model = YAModel.shared
    let draft: String?
    let focusOnAppear: Bool
    let topic: String?
    let placeholderOverride: String?
    let nav: Nav

    @StateObject private var top: Loader<[FeatureRequest]>
    @StateObject private var shipped: Loader<[FeatureRequest]>
    @State private var text: String
    @State private var thread: [ThreadItem] = []
    @State private var similar: [FeatureRequest] = []
    @State private var notices: [Notice]
    @State private var news: WhatsNew?
    @State private var shots: [UIImage] = []
    @State private var shotError: String?
    @State private var credit = false
    @State private var focused = false
    @State private var seq = 0
    @State private var arrivedIDs = Set<String>()

    init(draft: String?, focus: Bool, topic: String?, placeholder: String?, nav: Nav) {
        let m = YAModel.shared
        let client = m.client
        self.draft = draft; self.focusOnAppear = focus; self.topic = topic; self.placeholderOverride = placeholder; self.nav = nav
        _top = StateObject(wrappedValue: Loader { try await client.list(sort: "top", status: "active") })
        _shipped = StateObject(wrappedValue: Loader { try await client.list(sort: "new", status: "shipped") })
        _text = State(initialValue: draft ?? "")
        _notices = State(initialValue: m.config?.unseen ?? [])
        // What shipped since the last visit is shown once: read it now, then tell the server it's been seen.
        _news = State(initialValue: m.whatsNew)
    }

    private var sending: Bool { thread.contains { $0.isTyping } }
    private var canSend: Bool { text.trimmingCharacters(in: .whitespacesAndNewlines).count >= 3 && !sending }
    private var chatting: Bool { !thread.isEmpty }
    private var asking: String? { topic != nil && placeholderOverride != nil ? topic : nil }
    private var placeholder: String { placeholderOverride ?? "Ask for a feature…" }

    var body: some View {
        VStack(spacing: 0) {
            YAHeader(title: model.appName, subtitle: "Ideas, votes and what's new", onClose: nav.close,
                     leading: { AppAvatar(icon: model.appIcon) }, trailing: { EmptyView() })
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 10) {
                        chat
                        Color.clear.frame(height: 1).id("bottom")
                    }
                    .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 18)
                }
                .dismissKeyboardOnScroll()
                .onValueChange(of: thread.count) { _ in
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.06) { withAnimation { proxy.scrollTo("bottom", anchor: .bottom) } }
                }
            }
            composerArea
        }
        .onAppear(perform: appeared)
        .task { await focusIfNeeded() }
        .task(id: text) { await lookupSimilar() }
        .onValueChange(of: model.config?.unseen.map(\.id) ?? []) { _ in absorbArrivals() }
    }

    // MARK: pieces

    @ViewBuilder private var chat: some View {
        Bubble {
            Text(asking.map { "Let's talk about \($0). What's missing, or what bugs you?" } ?? model.greeting ?? "Hey! What would make \(model.appName) better for you?")
                .ya(15, line: 21)
        }
        if let news {
            let yours = news.items.first { $0.mine }
            Bubble(tone: yours != nil ? .win : .in, stretch: true) {
                Text(whatsNewHeading(news.total)).ya(12.5, .semibold, .muted, style: .caption)
                VStack(spacing: 0) {
                    ForEach(Array(news.items.enumerated()), id: \.element.id) { idx, i in
                        Tap(scale: false, action: { openRequest(i.id) }) {
                            HStack(spacing: 10) {
                                GreenDot()
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(i.title).ya(14.5, .semibold, line: 19).multilineTextAlignment(.leading)
                                    if i.mine { Text("You asked for this").ya(12, .bold, .green, style: .caption) }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                IconChevron(color: t.muted, size: 16)
                            }
                            .padding(.vertical, 8)
                            .overlay(alignment: .top) { if idx > 0 { Rectangle().fill(t.newsDivider).frame(height: 0.5) } }
                        }
                    }
                }
                if yours != nil { Text("That one was yours. Thanks for asking.").ya(15, line: 21) }
                if news.total > news.items.count {
                    BubbleLink(label: "See all \(news.total)") { nav.go(.board(tab: .shipped)) }
                }
            }
            .overlay(alignment: .topTrailing) { if yours != nil { Confetti().padding(.top, 14).padding(.trailing, 18) } }
        }
        ForEach(notices.filter { n in !(n.kind == "shipped" && (news?.items.contains { $0.id == n.requestId } ?? false)) }) { n in
            if n.kind == "reply" {
                ReplyBubble(notice: n, appName: model.appName) { openRequest(n.requestId) }
            } else {
                Bubble(tone: .win) {
                    HStack(spacing: 6) {
                        GreenDot(size: 18)
                        Text("It's live").ya(14, .bold, .green)
                    }
                    rich(("You asked for ", false), (n.title, true), (". \(n.shipNote ?? "Thanks for asking.")", false)).ya(15, line: 21)
                    BubbleLink(label: "See it") { openRequest(n.requestId) }
                }
            }
        }

        if !chatting {
            SectionBlock(title: "Popular right now", action: "See all", onAction: { nav.go(.board(tab: nil)) }) {
                if let e = top.error {
                    Text(errorText(e)).ya(13.5, .regular, .muted, line: 19).padding(.top, 2)
                } else if let d = top.data {
                    if d.isEmpty {
                        Text("No requests yet. Yours could be the first.").ya(13.5, .regular, .muted, line: 19)
                    } else {
                        VStack(spacing: 8) {
                            ForEach(d.prefix(3)) { r in
                                RequestRow(client: model.client, request: r, compact: true, onOpen: { openRequest(r.id) })
                            }
                        }
                    }
                } else {
                    Skeleton(rows: 2)
                }
            }
            if let s = shipped.data, !s.isEmpty {
                SectionBlock(title: "Recently shipped", action: "All", onAction: { nav.go(.board(tab: .shipped)) }) {
                    VStack(spacing: 0) {
                        ForEach(Array(s.prefix(3).enumerated()), id: \.element.id) { i, r in
                            Tap(scale: false, action: { openRequest(r.id) }) {
                                HStack(spacing: 10) {
                                    GreenDot()
                                    Text(r.title).ya(14.5, .medium).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                                    Text(r.shippedAt.map(ago) ?? "").ya(12.5, .regular, .muted, style: .caption)
                                }
                                .padding(.vertical, 9).padding(.horizontal, 2)
                                .overlay(alignment: .bottom) { if i < min(s.count, 3) - 1 { Rectangle().fill(t.border).frame(height: 0.5) } }
                            }
                            .accessibilityLabel("\(r.title), shipped \(r.shippedAt.map(ago) ?? "")")
                        }
                    }
                }
            }
        }

        ForEach(thread) { item in
            switch item {
            case .out(_, let text, let images):
                Bubble(tone: .out) {
                    ForEach(Array(images.enumerated()), id: \.offset) { _, img in
                        Image(uiImage: img).resizable().scaledToFill().frame(width: 200, height: 120).clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .accessibilityLabel("Your screenshot")
                    }
                    Text(text).ya(15, .regular, .accentFg, line: 21)
                }
            case .typing:
                TypingBubble()
            case .reply(_, let notice):
                ReplyBubble(notice: notice, appName: model.appName) { openRequest(notice.requestId) }
            case .posted(_, let request):
                Bubble {
                    rich(("Got it. ", false), (request.title, true), (" is on the board, and we'll tell you right here when it ships.", false)).ya(15, line: 21)
                    BubbleLink(label: "View request") { openRequest(request.id) }
                }
            case .error(_, let text):
                Bubble(tone: .error) { Text(text).ya(15, line: 21).accessibilityAddTraits(.isStaticText) }
            }
        }
        if chatting && !sending {
            HStack {
                Spacer()
                Tap(action: { nav.go(.board(tab: nil)) }) {
                    Text("See what others asked for").ya(13.5, .semibold, .accent)
                        .padding(.vertical, 8).padding(.horizontal, 14)
                        .background(RoundedRectangle(cornerRadius: t.buttonRadius ?? 999, style: .continuous).fill(t.tint))
                }
                Spacer()
            }
            .padding(.top, 6)
        }
    }

    private var composerArea: some View {
        VStack(spacing: 0) {
            if !similar.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Sounds like one of these. Vote instead?").ya(13, .bold, line: 18).padding(.horizontal, 2)
                    VStack(spacing: 8) {
                        ForEach(similar) { r in
                            RequestRow(client: model.client, request: r, compact: true, onTint: true, onOpen: { openRequest(r.id) })
                        }
                    }
                }
                .padding(10)
                .background(RoundedRectangle(cornerRadius: t.radius + 2, style: .continuous).fill(t.tint))
                .padding(.bottom, 8)
                .transition(.opacity)
            }
            if !shots.isEmpty {
                HStack(spacing: 6) {
                    ForEach(Array(shots.enumerated()), id: \.offset) { i, img in
                        HStack(spacing: 8) {
                            Image(uiImage: img).resizable().scaledToFill().frame(width: 40, height: 40).clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            Text("Screenshot\(shots.count > 1 ? " \(i + 1)" : "")").ya(13, .semibold)
                            Tap(label: "Remove screenshot", action: { shots.remove(at: i) }) {
                                IconClose(color: t.muted, size: 13).frame(width: 24, height: 24)
                            }
                        }
                        .padding(4)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(t.surface))
                    }
                    Spacer(minLength: 0)
                }
                .padding(.bottom, 8)
            }
            Composer(text: $text, placeholder: placeholder, label: asking != nil ? placeholder : "Ask for a feature", sendLabel: "Send",
                     maxLength: 2000, canSend: canSend, focused: $focused, onSend: send)
            if model.captureScreenshot != nil || (model.config?.canCredit == true && !text.trimmingCharacters(in: .whitespaces).isEmpty) {
                HStack(spacing: 8) {
                    if model.captureScreenshot != nil {
                        Tap(action: addShot) {
                            HStack(spacing: 6) {
                                IconFrame(color: t.accent, size: 16)
                                Text("Show us").ya(13.5, .semibold, .accent)
                            }
                            .padding(.leading, 10).padding(.trailing, 12).frame(height: 32)
                            .background(RoundedRectangle(cornerRadius: t.buttonRadius ?? 999, style: .continuous).fill(t.tint))
                        }
                        .disabled(sending || shots.count >= 3)
                    }
                    Spacer(minLength: 0)
                    if model.config?.canCredit == true && !text.trimmingCharacters(in: .whitespaces).isEmpty {
                        Tap(scale: false, action: { credit.toggle() }) {
                            HStack(spacing: 8) {
                                Text("Credit me when it ships").ya(13, .semibold, credit ? .fg : .muted, style: .footnote)
                                MiniToggle(on: credit)
                            }
                            .padding(.vertical, 4).padding(.leading, 8)
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("Credit me when it ships")
                        .accessibilityValue(credit ? "On" : "Off")
                        .accessibilityAddTraits(.isButton)
                    }
                }
                .frame(minHeight: 32)
                .padding(.top, 8)
            }
            if let shotError { Text(shotError).ya(13.5, .regular, .muted, line: 19).padding(.top, 10) }
            if model.config?.watermark == true {
                Text("Feedback by YouAsked").ya(11.5, .regular, .muted, style: .caption2).frame(maxWidth: .infinity).padding(.top, 8)
            }
        }
        .padding(.top, 8).padding(.horizontal, 12).padding(.bottom, 10)
        .background(t.bg.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Rectangle().fill(t.border).frame(height: 0.5) }
        .animation(.easeOut(duration: 0.2), value: similar.map(\.id))
    }

    // MARK: behaviour

    private func openRequest(_ id: String) { nav.go(.detail(id: id, from: .home)) }

    private func appeared() {
        if !notices.isEmpty { model.markSeen(notices.map(\.id)) }
        if let news {
            model.dismissWhatsNew()
            if news.items.contains(where: { $0.mine }) { Haptic.success() }
        }
        for n in notices { arrivedIDs.insert(n.id) }
        if model.nudgeVisible { model.nudgeEngaged() }
    }

    /// The team answering while this screen is open (the demo does this a few seconds after you post).
    private func absorbArrivals() {
        let arrived = (model.config?.unseen ?? []).filter { $0.kind == "reply" && !arrivedIDs.contains($0.id) }
        guard !arrived.isEmpty else { return }
        for n in arrived {
            arrivedIDs.insert(n.id)
            seq += 1
            thread.append(.reply(id: seq, notice: n))
        }
        model.markSeen(arrived.map(\.id))
        Haptic.success()
    }

    private func focusIfNeeded() async {
        guard focusOnAppear else { return }
        // Wait for the sheet to finish sliding up, or the keyboard fights the animation.
        try? await Task.sleep(nanoseconds: 380_000_000)
        if !Task.isCancelled { focused = true }
    }

    private func lookupSimilar() async {
        let q = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if q.count < 4 { similar = []; return }
        try? await Task.sleep(nanoseconds: 350_000_000)
        guard !Task.isCancelled else { return }
        if let r = try? await model.client.similar(q), !Task.isCancelled { similar = Array(r.prefix(3)) }
    }

    private func addShot() {
        shotError = nil
        Task {
            if let img = await model.captureScreenshot?() { shots.append(img) }
        }
    }

    private func send() {
        let message = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard message.count >= 3, !sending else { return }
        let attached = shots
        let credited = credit && model.config?.canCredit == true
        text = ""; similar = []; shots = []; shotError = nil; credit = false
        Haptic.light()
        seq += 1
        let outID = seq
        seq += 1
        thread.append(.out(id: outID, text: message, images: attached))
        thread.append(.typing(id: seq))
        let (title, body) = splitMessage(message)
        let client = model.client
        let ctx = topic.map { RequestContext(topic: $0) }
        Task {
            do {
                var ids: [String] = []
                for img in attached {
                    if let data = img.jpegData(compressionQuality: 0.85) { ids.append(try await client.upload(data, contentType: "image/jpeg").id) }
                }
                let started = Date()
                let created = try await client.create(NewRequest(title: title, body: body, attachments: ids.isEmpty ? nil : ids, context: ctx, credit: credited))
                let rest = 0.65 - Date().timeIntervalSince(started)
                if rest > 0 { try? await Task.sleep(nanoseconds: UInt64(rest * 1_000_000_000)) }
                thread.removeAll { $0.isTyping }
                seq += 1
                thread.append(.posted(id: seq, request: created.request))
                Haptic.success()
            } catch {
                thread.removeAll { $0.isTyping }
                thread.removeAll { if case .out(let id, _, _) = $0 { return id == outID } else { return false } }
                seq += 1
                thread.append(.error(id: seq, text: errorText((error as? YouAskedError)?.code ?? "network", detail: (error as? YouAskedError)?.detail)))
                text = message; shots = attached; credit = credited
            }
        }
    }
}
