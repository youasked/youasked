import SwiftUI
import UIKit

// MARK: - Text

enum Ink { case fg, muted, accent, accentFg, green, amber, red, custom(Color) }

extension Theme {
    func color(_ ink: Ink) -> Color {
        switch ink {
        case .fg: return fg
        case .muted: return muted
        case .accent: return accent
        case .accentFg: return accentFg
        case .green: return green
        case .amber: return amber
        case .red: return red
        case .custom(let c): return c
        }
    }
}

/// Text in the app's font and colour. Follows Dynamic Type but stops at 1.3x so the layout holds,
/// the same cap the React Native package uses.
private struct YAFont: ViewModifier {
    @Environment(\.yaTheme) private var theme
    @ScaledMetric private var scaled: CGFloat
    let size: CGFloat, weight: Font.Weight, ink: Ink, tracking: CGFloat, line: CGFloat?, mono: Bool

    init(size: CGFloat, weight: Font.Weight, ink: Ink, style: Font.TextStyle, tracking: CGFloat, line: CGFloat?, mono: Bool) {
        self.size = size; self.weight = weight; self.ink = ink; self.tracking = tracking; self.line = line; self.mono = mono
        _scaled = ScaledMetric(wrappedValue: size, relativeTo: style)
    }

    func body(content: Content) -> some View {
        let ratio = min(scaled / size, 1.3)
        let s = size * ratio
        var font: Font = theme.fontName.map { Font.custom($0, fixedSize: s).weight(weight) } ?? Font.system(size: s, weight: weight)
        if mono { font = font.monospacedDigit() }
        return content
            .font(font)
            .foregroundColor(theme.color(ink))
            .modifier(Tracking(value: tracking))
            .lineSpacing(line.map { max(0, $0 * ratio - s * 1.19) } ?? 0)
    }
}

private struct Tracking: ViewModifier {
    let value: CGFloat
    func body(content: Content) -> some View {
        if #available(iOS 16.0, *) { content.tracking(value) } else { content }
    }
}

extension View {
    func ya(_ size: CGFloat, _ weight: Font.Weight = .regular, _ ink: Ink = .fg, style: Font.TextStyle = .body,
            tracking: CGFloat = 0, line: CGFloat? = nil, mono: Bool = false) -> some View {
        modifier(YAFont(size: size, weight: weight, ink: ink, style: style, tracking: tracking, line: line, mono: mono))
    }

    @ViewBuilder func `if`<T: View>(_ condition: Bool, _ transform: (Self) -> T) -> some View {
        if condition { transform(self) } else { self }
    }

    /// `onChange` without the iOS 17 deprecation.
    @ViewBuilder func onValueChange<V: Equatable>(of value: V, _ action: @escaping (V) -> Void) -> some View {
        if #available(iOS 17.0, *) {
            self.onChange(of: value) { _, new in action(new) }
        } else {
            self.onChange(of: value, perform: action)
        }
    }

    @ViewBuilder func dismissKeyboardOnScroll() -> some View {
        if #available(iOS 16.0, *) { self.scrollDismissesKeyboard(.interactively) } else { self }
    }

    @ViewBuilder func hideScrollBackground() -> some View {
        if #available(iOS 16.0, *) { self.scrollContentBackground(.hidden) } else { self }
    }
}

/// Text with some words bold: `rich("You asked for ", bold: "Dark mode", ". It's live.")`.
func rich(_ parts: (String, Bool)...) -> Text {
    var out = AttributedString()
    for (s, bold) in parts {
        var a = AttributedString(s)
        if bold { a.inlinePresentationIntent = .stronglyEmphasized }
        out += a
    }
    return Text(out)
}

// MARK: - Haptics

@MainActor
enum Haptic {
    static func light() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
}

// MARK: - Taps

/// Dims slightly while held, the way native buttons do.
struct TapStyle: ButtonStyle {
    var scale = true
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.8 : 1)
            .scaleEffect(configuration.isPressed && scale ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct Tap<Label: View>: View {
    var scale = true
    var label: String?
    var action: () -> Void
    @ViewBuilder var content: () -> Label
    var body: some View {
        Button(action: action) { content().contentShape(Rectangle()) }
            .buttonStyle(TapStyle(scale: scale))
            .if(label != nil) { $0.accessibilityLabel(label!) }
    }
}

// MARK: - Shapes

/// A rounded rectangle with a different radius on each corner (UnevenRoundedRectangle needs iOS 16).
struct CornerShape: Shape {
    var tl: CGFloat, tr: CGFloat, bl: CGFloat, br: CGFloat
    init(_ r: CGFloat, tl: CGFloat? = nil, tr: CGFloat? = nil, bl: CGFloat? = nil, br: CGFloat? = nil) {
        self.tl = tl ?? r; self.tr = tr ?? r; self.bl = bl ?? r; self.br = br ?? r
    }
    func path(in rect: CGRect) -> Path {
        let w = rect.width, h = rect.height
        let tl = min(self.tl, min(w, h) / 2), tr = min(self.tr, min(w, h) / 2)
        let bl = min(self.bl, min(w, h) / 2), br = min(self.br, min(w, h) / 2)
        var p = Path()
        p.move(to: CGPoint(x: rect.minX + tl, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX - tr, y: rect.minY))
        p.addArc(center: CGPoint(x: rect.maxX - tr, y: rect.minY + tr), radius: tr, startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - br))
        p.addArc(center: CGPoint(x: rect.maxX - br, y: rect.maxY - br), radius: br, startAngle: .degrees(0), endAngle: .degrees(90), clockwise: false)
        p.addLine(to: CGPoint(x: rect.minX + bl, y: rect.maxY))
        p.addArc(center: CGPoint(x: rect.minX + bl, y: rect.maxY - bl), radius: bl, startAngle: .degrees(90), endAngle: .degrees(180), clockwise: false)
        p.addLine(to: CGPoint(x: rect.minX, y: rect.minY + tl))
        p.addArc(center: CGPoint(x: rect.minX + tl, y: rect.minY + tl), radius: tl, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false)
        p.closeSubpath()
        return p
    }
}

// MARK: - Small pieces

func ago(_ t: Double) -> String {
    let s = max(0, Int((Date().timeIntervalSince1970 - t / 1000).rounded()))
    if s < 60 { return "just now" }
    let m = Int((Double(s) / 60).rounded())
    if m < 60 { return "\(m)m ago" }
    let h = Int((Double(m) / 60).rounded())
    if h < 24 { return "\(h)h ago" }
    let d = Int((Double(h) / 24).rounded())
    if d < 30 { return "\(d)d ago" }
    let f = DateFormatter()
    f.setLocalizedDateFormatFromTemplate("MMM d")
    return f.string(from: Date(timeIntervalSince1970: t / 1000))
}

func errorText(_ code: String?, detail: String? = nil) -> String {
    if let detail, !detail.isEmpty { return detail }
    switch code {
    case "signature_required", "bad_signature": return "We couldn't confirm who you are. Restart the app and try again."
    case "slow_down": return "That's a lot of requests in an hour. Try again a bit later."
    case "title_too_short": return "Add a few more words so others know what you mean."
    case "network": return "Couldn't reach the server. Check your connection and try again."
    default: return "Something went wrong. Try again."
    }
}

func whatsNewHeading(_ total: Int) -> String { "\(total) \(total == 1 ? "thing" : "things") shipped since your last visit" }

struct StatusPill: View {
    @Environment(\.yaTheme) private var t
    var status: RequestStatus
    var body: some View {
        let tone: (Color, Ink) = {
            switch status {
            case .planned: return (t.tint, .accent)
            case .inProgress: return (t.amberTint, .amber)
            case .shipped: return (t.greenTint, .green)
            default: return (t.bg, .muted)
            }
        }()
        HStack(spacing: 5) {
            if status == .shipped { IconCheck(color: t.color(tone.1), size: 11) }
            Text(status.label).ya(12, .semibold, tone.1, style: .caption)
        }
        .padding(.vertical, 2).padding(.horizontal, 8)
        .background(Capsule().fill(tone.0))
    }
}

struct GreenDot: View {
    @Environment(\.yaTheme) private var t
    var size: CGFloat = 22
    var body: some View {
        ZStack {
            Circle().fill(t.shippedDot)
            IconCheck(color: t.green, size: 13)
        }
        .frame(width: size, height: size)
    }
}

struct Badge: View {
    var count: Int
    var body: some View {
        Text("\(count)").ya(12, .bold, .custom(.white), style: .caption)
            .padding(.horizontal, 6)
            .frame(minWidth: 20, minHeight: 20)
            .background(Capsule().fill(Color(red: 1, green: 0.231, blue: 0.188)))
            .accessibilityLabel("\(count) new")
    }
}

struct EmptyState: View {
    var title: String
    var message: String?
    var body: some View {
        VStack(spacing: 4) {
            Text(title).ya(16, .bold, style: .headline)
            if let message {
                Text(message).ya(14.5, .regular, .muted, line: 20).multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 44).padding(.horizontal, 16)
        .accessibilityElement(children: .combine)
    }
}

struct Skeleton: View {
    @Environment(\.yaTheme) private var t
    var rows = 3
    @State private var dim = true
    var body: some View {
        VStack(spacing: 8) {
            ForEach(0..<rows, id: \.self) { _ in
                RoundedRectangle(cornerRadius: t.radius).fill(t.surface).frame(height: 58)
            }
        }
        .opacity(dim ? 0.55 : 1)
        .onAppear { withAnimation(.easeInOut(duration: 0.65).repeatForever(autoreverses: true)) { dim = false } }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading")
    }
}

/// The app's own icon, or nothing. A guessed letter tile looks generic, so it's never drawn.
struct AppAvatar: View {
    @Environment(\.yaTheme) private var t
    var icon: AppIcon?
    var size: CGFloat = 36
    var round = false
    var body: some View {
        if let icon {
            Group {
                switch icon.source {
                case .image(let img):
                    Image(uiImage: img).resizable().scaledToFill()
                case .url(let url):
                    AsyncImage(url: url) { phase in
                        if let image = phase.image { image.resizable().scaledToFill() } else { Color.clear }
                    }
                }
            }
            .frame(width: size, height: size)
            .background(t.surface)
            .clipShape(RoundedRectangle(cornerRadius: round ? size / 2 : size * 0.24, style: .continuous))
            .accessibilityHidden(true)
        }
    }
}

struct RoundIconButton: View {
    @Environment(\.yaTheme) private var t
    var label: String
    var plain = false
    var action: () -> Void
    var icon: AnyView
    var body: some View {
        Tap(label: label, action: action) {
            icon.frame(width: 34, height: 34).background(Circle().fill(plain ? Color.clear : t.surface))
        }
    }
}

struct LinkButton: View {
    @Environment(\.yaTheme) private var t
    var label: String
    var chevron = false
    var action: () -> Void
    var body: some View {
        Tap(action: action) {
            HStack(spacing: 0) {
                Text(label).ya(14, .semibold, .accent)
                if chevron { IconChevron(color: t.accent, size: 15) }
            }
            .padding(.vertical, 6).padding(.horizontal, 8)
        }
    }
}

struct YAButton: View {
    @Environment(\.yaTheme) private var t
    var label: String
    var small = false
    var ghost = false
    var icon: AnyView?
    var fill = false
    var action: () -> Void
    var body: some View {
        let r = t.buttonRadius ?? (small ? max(t.radius - 3, 8) : t.radius)
        Tap(action: action) {
            HStack(spacing: 8) {
                icon
                Text(label).ya(small ? 14 : 15, .bold, ghost ? .fg : .accentFg).lineLimit(1)
            }
            .padding(.horizontal, small ? 14 : 18)
            .frame(maxWidth: fill ? .infinity : nil)
            .frame(height: small ? 38 : 48)
            .background(RoundedRectangle(cornerRadius: r, style: .continuous).fill(ghost ? t.surface : t.accent))
        }
        .accessibilityLabel(label)
    }
}

/// A small iOS-style switch.
struct MiniToggle: View {
    @Environment(\.yaTheme) private var t
    var on: Bool
    var body: some View {
        ZStack(alignment: .leading) {
            Capsule().fill(on ? t.accent : t.switchTrack).frame(width: 34, height: 20)
            Circle().fill(Color.white).frame(width: 16, height: 16)
                .shadow(color: .black.opacity(0.3), radius: 1.5, y: 1)
                .offset(x: on ? 16 : 2)
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: on)
    }
}

/// Fades and nudges a screen in when it first shows.
struct FadeIn: ViewModifier {
    @State private var shown = false
    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 8)
            .onAppear { withAnimation(.easeOut(duration: 0.2)) { shown = true } }
    }
}

struct SectionBlock<Content: View>: View {
    @Environment(\.yaTheme) private var t
    var title: String
    var action: String?
    var onAction: (() -> Void)?
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(title).ya(13, .semibold, .muted, style: .footnote).accessibilityAddTraits(.isHeader)
                Spacer()
                if let action { LinkButton(label: action, chevron: true) { onAction?() } }
            }
            .padding(.bottom, 8)
            content()
        }
        .padding(.top, 12)
    }
}

// MARK: - Header

struct YAHeader<Leading: View, Trailing: View>: View {
    @Environment(\.yaTheme) private var t
    var title: String
    var subtitle: String?
    var onBack: (() -> Void)?
    var onClose: (() -> Void)?
    @ViewBuilder var leading: () -> Leading
    @ViewBuilder var trailing: () -> Trailing
    var body: some View {
        HStack(spacing: 10) {
            if let onBack {
                RoundIconButton(label: "Back", plain: true, action: onBack, icon: AnyView(IconBack(color: t.muted)))
            }
            leading()
            VStack(alignment: .leading, spacing: 1) {
                Text(title).ya(17, .bold, style: .headline, tracking: -0.2).lineLimit(1).accessibilityAddTraits(.isHeader)
                if let subtitle { Text(subtitle).ya(12.5, .regular, .muted, style: .caption).lineLimit(2) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            trailing()
            if let onClose {
                RoundIconButton(label: "Close", action: onClose, icon: AnyView(IconClose(color: t.muted, size: 17)))
            }
        }
        .padding(.top, 18).padding(.trailing, 12).padding(.bottom, 10).padding(.leading, onBack != nil ? 8 : 18)
    }
}

extension YAHeader where Leading == EmptyView, Trailing == EmptyView {
    init(title: String, subtitle: String? = nil, onBack: (() -> Void)? = nil, onClose: (() -> Void)? = nil) {
        self.init(title: title, subtitle: subtitle, onBack: onBack, onClose: onClose, leading: { EmptyView() }, trailing: { EmptyView() })
    }
}

// MARK: - Loading

@MainActor
final class Loader<T>: ObservableObject {
    @Published var data: T?
    @Published var error: String?
    private let work: () async throws -> T

    init(_ work: @escaping () async throws -> T) {
        self.work = work
        Task { await run() }
    }

    func run() async {
        error = nil
        do {
            let d = try await work()
            data = d
        } catch is CancellationError {
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            self.error = (error as? YouAskedError)?.code ?? "network"
        }
    }
}

// MARK: - Votes

@MainActor
final class VoteState: ObservableObject {
    @Published var voted: Bool
    @Published var votes: Int
    private let id: String
    private let client: any YouAskedAPI
    private var busy = false

    init(client: any YouAskedAPI, request: FeatureRequest) {
        self.client = client; id = request.id; voted = request.voted; votes = request.votes
    }

    func sync(_ r: FeatureRequest) { voted = r.voted; votes = r.votes }

    func toggle() {
        guard !busy else { return }
        busy = true
        let before = (voted, votes)
        Haptic.light()
        voted = !before.0
        votes = before.1 + (before.0 ? -1 : 1)
        Task {
            do {
                let r = try await client.vote(id)
                voted = r.voted; votes = r.votes
            } catch {
                voted = before.0; votes = before.1
            }
            busy = false
        }
    }
}

struct VoteButton: View {
    @Environment(\.yaTheme) private var t
    @StateObject private var state: VoteState
    let request: FeatureRequest
    var compact = false
    @State private var pop = false

    init(client: any YouAskedAPI, request: FeatureRequest, compact: Bool = false) {
        _state = StateObject(wrappedValue: VoteState(client: client, request: request))
        self.request = request; self.compact = compact
    }

    var body: some View {
        let ink: Ink = state.voted ? .accentFg : .fg
        Button(action: state.toggle) {
            VStack(spacing: 0) {
                IconUp(color: t.color(ink), size: compact ? 14 : 16)
                Text("\(state.votes)").ya(compact ? 13 : 14, .bold, ink, style: .footnote, line: compact ? 16 : 17, mono: true)
            }
            .padding(.vertical, compact ? 3 : 5)
            .frame(width: compact ? 40 : 46)
            .background(RoundedRectangle(cornerRadius: max(t.radius - 4, 6), style: .continuous).fill(state.voted ? t.accent : t.bg))
            .overlay(RoundedRectangle(cornerRadius: max(t.radius - 4, 6), style: .continuous).stroke(state.voted ? t.accent : t.border, lineWidth: 1))
            .scaleEffect(pop ? 1.14 : 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(TapStyle())
        .accessibilityLabel("\(state.voted ? "Remove vote" : "Upvote"): \(request.title). \(state.votes) \(state.votes == 1 ? "vote" : "votes")")
        .accessibilityAddTraits(state.voted ? .isSelected : [])
        .onValueChange(of: request.votes) { _ in state.sync(request) }
        .onValueChange(of: request.voted) { _ in state.sync(request) }
        .onValueChange(of: state.voted) { on in
            guard on else { return }
            withAnimation(.easeOut(duration: 0.09)) { pop = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.09) { withAnimation(.spring(response: 0.3, dampingFraction: 0.45)) { pop = false } }
        }
    }
}

struct BigVote: View {
    @Environment(\.yaTheme) private var t
    @StateObject private var state: VoteState
    let request: FeatureRequest
    var onChange: ((Bool) -> Void)?
    @State private var pop = false

    init(client: any YouAskedAPI, request: FeatureRequest, onChange: ((Bool) -> Void)? = nil) {
        _state = StateObject(wrappedValue: VoteState(client: client, request: request))
        self.request = request; self.onChange = onChange
    }

    var body: some View {
        let ink: Ink = state.voted ? .accentFg : .fg
        HStack {
            Button(action: state.toggle) {
                HStack(spacing: 8) {
                    IconUp(color: t.color(ink), size: 17)
                    Text("\(state.voted ? "Voted" : "Upvote") · \(state.votes)").ya(14.5, .bold, ink, mono: true)
                }
                .padding(.leading, 12).padding(.trailing, 16)
                .frame(height: 40)
                .background(RoundedRectangle(cornerRadius: t.buttonRadius ?? 999, style: .continuous).fill(state.voted ? t.accent : Color.clear))
                .overlay(RoundedRectangle(cornerRadius: t.buttonRadius ?? 999, style: .continuous).stroke(state.voted ? t.accent : t.border, lineWidth: 1))
                .scaleEffect(pop ? 1.14 : 1)
                .contentShape(Rectangle())
            }
            .buttonStyle(TapStyle())
            .accessibilityLabel("\(state.voted ? "Remove vote" : "Upvote"). \(state.votes) \(state.votes == 1 ? "vote" : "votes")")
            .accessibilityAddTraits(state.voted ? .isSelected : [])
            Spacer(minLength: 0)
        }
        .padding(.top, 16)
        .onAppear { onChange?(state.voted) }
        .onValueChange(of: state.voted) { on in
            onChange?(on)
            guard on else { return }
            withAnimation(.easeOut(duration: 0.09)) { pop = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.09) { withAnimation(.spring(response: 0.3, dampingFraction: 0.45)) { pop = false } }
        }
    }
}

struct RequestRow: View {
    @Environment(\.yaTheme) private var t
    let client: any YouAskedAPI
    let request: FeatureRequest
    var compact = false
    var onTint = false
    var onOpen: () -> Void

    var body: some View {
        HStack(spacing: compact ? 10 : 12) {
            VoteButton(client: client, request: request, compact: compact)
            Button(action: onOpen) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(request.title).ya(compact ? 14.5 : 15, .semibold, line: 20).multilineTextAlignment(.leading)
                    if request.status != .open || request.comments > 0 || request.mine {
                        HStack(spacing: 8) {
                            if request.status != .open { StatusPill(status: request.status) }
                            if request.comments > 0 {
                                HStack(spacing: 4) {
                                    IconChat(color: t.muted, size: 13)
                                    Text("\(request.comments)").ya(12.5, .regular, .muted, style: .caption)
                                }
                                .accessibilityElement(children: .combine)
                                .accessibilityLabel("\(request.comments) \(request.comments == 1 ? "comment" : "comments")")
                            }
                            if request.mine { Text("You asked").ya(12.5, .regular, .muted, style: .caption) }
                        }
                    }
                }
                .padding(.vertical, 2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(TapStyle(scale: false))
            .accessibilityHint("Opens the request")
        }
        .padding(.vertical, compact ? 8 : 10).padding(.horizontal, compact ? 10 : 12)
        .background(RoundedRectangle(cornerRadius: t.radius, style: .continuous).fill(onTint ? t.bg : t.surface))
    }
}

// MARK: - Text input

/// A growing, multi-line text field that works on iOS 15 (TextField(axis:) needs 16).
struct GrowingTextView: UIViewRepresentable {
    @Environment(\.yaTheme) private var t
    @Binding var text: String
    @Binding var isFocused: Bool
    @Binding var height: CGFloat
    var placeholder: String
    var accessibilityLabel: String
    var maxLength: Int
    var maxHeight: CGFloat = 132

    func makeUIView(context: Context) -> UITextView {
        let v = UITextView()
        v.delegate = context.coordinator
        v.backgroundColor = .clear
        v.textContainerInset = UIEdgeInsets(top: 9, left: 0, bottom: 9, right: 0)
        v.textContainer.lineFragmentPadding = 0
        v.adjustsFontForContentSizeCategory = true
        v.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        v.isScrollEnabled = true
        v.returnKeyType = .default
        return v
    }

    func updateUIView(_ v: UITextView, context: Context) {
        context.coordinator.parent = self
        let base: UIFont = {
            if let n = t.fontName, let f = UIFont(name: n, size: 16) { return UIFontMetrics(forTextStyle: .body).scaledFont(for: f, maximumPointSize: 16 * 1.3) }
            return UIFontMetrics(forTextStyle: .body).scaledFont(for: .systemFont(ofSize: 16), maximumPointSize: 16 * 1.3)
        }()
        if v.font != base { v.font = base }
        v.textColor = UIColor(t.fg)
        v.tintColor = UIColor(t.accent)
        v.keyboardAppearance = t.dark ? .dark : .light
        v.accessibilityLabel = accessibilityLabel
        if v.text != text { v.text = text }
        context.coordinator.updatePlaceholder(v, text: placeholder, color: UIColor(t.muted), font: base)
        DispatchQueue.main.async {
            let h = v.sizeThatFits(CGSize(width: v.bounds.width > 0 ? v.bounds.width : 280, height: .greatestFiniteMagnitude)).height
            let clamped = max(40, min(h, maxHeight))
            if abs(clamped - height) > 0.5 { height = clamped }
            v.isScrollEnabled = h > maxHeight
            if isFocused, !v.isFirstResponder { v.becomeFirstResponder() }
            if !isFocused, v.isFirstResponder { v.resignFirstResponder() }
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: GrowingTextView
        private let label = UILabel()
        init(_ p: GrowingTextView) { parent = p }

        func updatePlaceholder(_ v: UITextView, text: String, color: UIColor, font: UIFont) {
            if label.superview == nil {
                label.numberOfLines = 1
                label.isAccessibilityElement = false
                label.translatesAutoresizingMaskIntoConstraints = false
                v.addSubview(label)
                NSLayoutConstraint.activate([
                    label.leadingAnchor.constraint(equalTo: v.leadingAnchor),
                    label.topAnchor.constraint(equalTo: v.topAnchor, constant: 9),
                    label.widthAnchor.constraint(equalTo: v.widthAnchor),
                ])
            }
            label.text = text
            label.textColor = color
            label.font = font
            label.isHidden = !v.text.isEmpty
        }

        func textViewDidChange(_ v: UITextView) {
            parent.text = v.text
            label.isHidden = !v.text.isEmpty
        }
        func textView(_ v: UITextView, shouldChangeTextIn range: NSRange, replacementText s: String) -> Bool {
            guard parent.maxLength > 0 else { return true }
            let current = (v.text as NSString).replacingCharacters(in: range, with: s)
            return current.count <= parent.maxLength
        }
        func textViewDidBeginEditing(_ v: UITextView) { if !parent.isFocused { parent.isFocused = true } }
        func textViewDidEndEditing(_ v: UITextView) { if parent.isFocused { parent.isFocused = false } }
    }
}

/// The rounded message box with a send button, used for the composer and the reply bar.
struct Composer: View {
    @Environment(\.yaTheme) private var t
    @Binding var text: String
    var placeholder: String
    var label: String
    var sendLabel: String
    var maxLength: Int
    var canSend: Bool
    @Binding var focused: Bool
    var onSend: () -> Void
    @State private var height: CGFloat = 40

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            GrowingTextView(text: $text, isFocused: $focused, height: $height, placeholder: placeholder, accessibilityLabel: label, maxLength: maxLength)
                .frame(height: height)
            Button(action: onSend) {
                IconSend(color: t.accentFg)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(t.accent))
                    .opacity(canSend ? 1 : 0.3)
            }
            .buttonStyle(TapStyle())
            .disabled(!canSend)
            .accessibilityLabel(sendLabel)
        }
        .padding(.vertical, 4).padding(.leading, 16).padding(.trailing, 4)
        .background(RoundedRectangle(cornerRadius: t.buttonRadius ?? 24, style: .continuous).fill(t.surface))
        .overlay(RoundedRectangle(cornerRadius: t.buttonRadius ?? 24, style: .continuous).stroke(focused ? t.composerFocus : Color.clear, lineWidth: 1.5))
    }
}
