import SwiftUI
import UIKit

enum BoardTab: String { case top, new, shipped }

enum Route: Equatable {
    case home(draft: String?, focus: Bool, topic: String?, placeholder: String?)
    case board(tab: BoardTab?)
    /// `from` is where Back goes: the list they opened it from.
    case detail(id: String, from: From?)
    case mine

    enum From { case home, board, mine }

    var key: String {
        switch self {
        case .home(let d, let f, let t, _): return "home\(d ?? "")\(f ? "f" : "")\(t ?? "")"
        case .board(let tab): return "board\(tab?.rawValue ?? "")"
        case .detail(let id, _): return "d\(id)"
        case .mine: return "mine"
        }
    }
}

/// Where to land when the sheet opens.
public enum OpenView: Sendable {
    /// The chat-style start screen.
    case home
    /// The start screen with the composer focused.
    case new
    case board
    /// The board, on the Shipped tab.
    case shipped
    /// The person's own requests.
    case mine
}

/// The icon of your app, shown in the sheet header and next to team replies.
public struct AppIcon {
    enum Source { case url(URL), image(UIImage) }
    let source: Source
    public static func url(_ url: URL) -> AppIcon { AppIcon(source: .url(url)) }
    public static func image(_ image: UIImage) -> AppIcon { AppIcon(source: .image(image)) }
    /// An image from your asset catalog.
    public static func asset(_ name: String) -> AppIcon? { UIImage(named: name).map { AppIcon(source: .image($0)) } }
}

public enum LauncherPosition: Sendable { case bottomTrailing, bottomLeading }
public enum LauncherTrigger: Sendable { case floating, none }

struct HostOptions: Equatable {
    var trigger: LauncherTrigger = .floating
    var position: LauncherPosition = .bottomTrailing
    var label: String?
    var offset: CGFloat = 20
    var cards = true
}

@MainActor
final class YAModel: ObservableObject {
    static let shared = YAModel()

    // Settings the developer chose.
    @Published var appearance = Appearance.default
    @Published var appNameOverride: String?
    @Published var appIcon: AppIcon?
    @Published var greeting: String?
    @Published var title = "Feature requests"
    var nudgeOption: NudgeOption = .automatic
    var captureScreenshot: (@MainActor () async -> UIImage?)?
    @Published var host = HostOptions()

    // State.
    @Published private(set) var client: any YouAskedAPI = LiveClient(appKey: "")
    @Published private(set) var config: Config?
    @Published private(set) var whatsNew: WhatsNew?
    @Published var whatsNewToast = false
    @Published private(set) var disabled = false
    @Published var route: Route?
    @Published var isPresented = false
    @Published var nudgeSettings: NudgeSettings?
    @Published var nudgeVisible = false

    private var appKey = ""
    private var apiURL = defaultAPIURL
    private var user: YouAskedUser?
    private var signature: String?
    var demoShowsNews = true
    private(set) var demo = false
    private var demoName: String?
    private var configured = false
    private var lastLoad: Date = .distantPast
    private var loadTask: Task<Void, Never>?
    private var warnedTestMode = false
    private var observer: NSObjectProtocol?

    var appName: String { appNameOverride ?? demoName ?? config?.app.name ?? "us" }
    var unseen: [Notice] { config?.unseen ?? [] }
    var theme: (ColorScheme) -> Theme { { Theme.resolve(self.appearance, scheme: $0) } }

    // MARK: configuring

    func configure(appKey: String, apiURL: URL, demo: Bool, appName: String?) {
        self.appKey = appKey
        self.apiURL = apiURL
        self.demo = demo
        self.demoName = demo ? (appName ?? "Acme") : nil
        if let appName { appNameOverride = appName }
        configured = true
        rebuildClient()
        if observer == nil {
            observer = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in
                    guard let self, Date().timeIntervalSince(self.lastLoad) > 60 else { return }
                    self.reload()
                }
            }
        }
        reload()
        startNudgeTimer()
    }

    func identify(user: YouAskedUser?, signature: String?) {
        self.user = user
        self.signature = signature
        guard configured else { return }
        rebuildClient()
        reload()
    }

    private func rebuildClient() {
        if demo {
            client = DemoClient(appName: demoName ?? "Acme", showsNews: demoShowsNews) { [weak self] n in
                Task { @MainActor in
                    guard let self, var c = self.config else { return }
                    c.unseen.append(n)
                    self.config = c
                }
            }
        } else {
            client = LiveClient(appKey: appKey, apiURL: apiURL, user: user, signature: signature)
        }
    }

    private var whatsNewKey: String? {
        demo ? nil : "youasked:whats-new:\(appKey):\(user?.id ?? "anon")"
    }

    private static func covered(_ news: WhatsNew?, _ n: Notice) -> Bool {
        n.kind == "shipped" && (news?.items.contains { $0.id == n.requestId } ?? false)
    }

    /// Loads the config once; later calls do nothing until `reload()`.
    func ensureLoaded() {
        guard configured, config == nil, loadTask == nil, !disabled else { return }
        reload()
    }

    func reload() {
        guard configured, demo || !appKey.isEmpty else { return }
        loadTask?.cancel()
        lastLoad = Date()
        let client = self.client
        loadTask = Task { [weak self] in
            do {
                let c = try await client.config()
                guard let self, !Task.isCancelled else { return }
                // Only what shipped after the last time they were shown the list, even if the server missed the news.
                let seenAt = self.whatsNewKey.map { UserDefaults.standard.double(forKey: $0) } ?? 0
                let items = c.whatsNew?.items.filter { $0.shippedAt > seenAt } ?? []
                var news: WhatsNew?
                if var w = c.whatsNew, !items.isEmpty { w.items = items; news = w }
                self.disabled = false
                self.config = c
                self.whatsNew = news
                // A toast on first load, unless a notice that isn't already part of the list is waiting.
                self.whatsNewToast = news != nil && !c.unseen.contains { !Self.covered(news, $0) }
                self.nudgeSettings = NudgeLogic.resolve(server: c.nudge, option: self.nudgeOption)
                self.beginNudgeVisit()
            } catch let e as YouAskedError where e.code == "test_mode" {
                guard let self else { return }
                self.disabled = true
                if !self.warnedTestMode {
                    self.warnedTestMode = true
                    print("[YouAsked] This app is in test mode, so feature requests are hidden in this build. Subscribe at https://app.youasked.dev to turn them on.")
                }
            } catch {
                // Offline or a bad key: stay quiet. The entry points just show what they can.
            }
            self?.loadTask = nil
        }
    }

    // MARK: opening

    func open(view: OpenView? = nil, requestId: String? = nil, draft: String? = nil, topic: String? = nil, placeholder: String? = nil) {
        guard !disabled else { return }
        route = Self.route(view: view, requestId: requestId, draft: draft, topic: topic, placeholder: placeholder)
        nudgeEngaged()
        isPresented = true
    }

    /// Topics that tag a request without changing how the composer talks.
    nonisolated static let quietTopics: Set<String> = ["search", "locked"]

    nonisolated static func route(view: OpenView?, requestId: String?, draft: String?, topic rawTopic: String?, placeholder: String?) -> Route {
        if let requestId { return .detail(id: requestId, from: nil) }
        let topic = rawTopic?.trimmingCharacters(in: .whitespaces).nilIfEmpty
        let ph = placeholder ?? ((topic != nil && draft == nil && !quietTopics.contains(topic!)) ? "What would make \(topic!) better?" : nil)
        switch view {
        case .new?: return .home(draft: draft, focus: true, topic: topic, placeholder: ph)
        case .board?: return .board(tab: nil)
        case .shipped?: return .board(tab: .shipped)
        case .mine?: return .mine
        case .home?, nil: return .home(draft: draft, focus: draft != nil || topic != nil, topic: topic, placeholder: ph)
        }
    }

    func close() { isPresented = false }

    func sheetDismissed() { route = nil }

    func markSeen(_ ids: [String]) {
        guard !ids.isEmpty else { return }
        if var c = config {
            c.unseen.removeAll { ids.contains($0.id) }
            config = c
        }
        let client = self.client
        Task { try? await client.seen(ids) }
    }

    func dismissWhatsNew() {
        whatsNew = nil
        whatsNewToast = false
        if let k = whatsNewKey { UserDefaults.standard.set(Date().timeIntervalSince1970 * 1000, forKey: k) }
        let client = self.client
        Task { try? await client.whatsNewSeen() }
    }

    /// The card to show floating over the app, if any: "it's live" first, then a reply.
    var toastNotice: Notice? {
        let standing = unseen.filter { !Self.covered(whatsNew, $0) }
        return standing.first { $0.kind == "shipped" } ?? standing.first { $0.kind == "reply" }
    }

    // MARK: nudge

    private var nudgeMemory: NudgeMemory?
    private var nudgeStore = NudgeStore(key: nil)
    private var activeSeconds = 0.0
    private var timer: Timer?

    private func beginNudgeVisit() {
        guard nudgeSettings != nil, nudgeMemory == nil else { return }
        nudgeStore = NudgeStore(key: demo ? nil : "youasked:nudge:\(appKey):\(user?.id ?? "anon")")
        guard !demo else { nudgeMemory = nil; visitCounted = true; return }
        let m = NudgeLogic.countVisit(nudgeStore.load(), now: Date().timeIntervalSince1970 * 1000)
        nudgeStore.save(m)
        nudgeMemory = m
        visitCounted = true
    }
    private var visitCounted = false

    var nudgeBlocked: Bool { isPresented || (host.cards && toastNotice != nil) || (host.cards && whatsNewToast && whatsNew != nil) }

    func startNudgeTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }

    private func tick() {
        guard let s = nudgeSettings, visitCounted, !nudgeVisible, !disabled else { return }
        guard UIApplication.shared.applicationState == .active, !nudgeBlocked else { return }
        activeSeconds += 1
        guard activeSeconds >= s.activeSeconds else { return }
        activeSeconds = -.infinity  // decide once per visit, like the web version's cleared interval
        let now = Date().timeIntervalSince1970 * 1000
        guard NudgeLogic.isDue(demo ? nil : nudgeMemory, settings: s, now: now) else { return }
        if var m = nudgeMemory { m.lastShownAt = now; nudgeMemory = m; nudgeStore.save(m) }
        nudgeVisible = true
    }

    /// They opened the sheet, from the prompt or anywhere else: no prompt until the interval passes.
    func nudgeEngaged() {
        if var m = nudgeMemory {
            m.lastEngagedAt = Date().timeIntervalSince1970 * 1000
            m.dismissals = 0
            nudgeMemory = m
            nudgeStore.save(m)
        }
        nudgeVisible = false
    }

    func nudgeDismissed() {
        if var m = nudgeMemory {
            m.dismissals += 1
            nudgeMemory = m
            nudgeStore.save(m)
        }
        nudgeVisible = false
    }

    /// For previews and screenshots: skip the wait.
    func showNudgeNow() { nudgeVisible = true }
}

extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
