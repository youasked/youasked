import Foundation

/// A pretend backend for `YouAsked.configureDemo()`: sample requests in memory, a little fake latency, and a
/// "team" that answers a few seconds after you post or comment. Nothing leaves the device.
/// Mirrors packages/react-native/src/demo.ts.
actor DemoClient: YouAskedAPI {
    private struct Stored {
        var r: FeatureRequest
        var comments: [RequestComment] = []
        var attachments: [Attachment] = []
        var early = false
    }

    private var store: [Stored] = []
    private var seq = 100
    private var answered = Set<String>()
    private var uploads: [String: Attachment] = [:]
    private let appName: String
    private let configValue: Config
    private let onNotice: @Sendable (Notice) -> Void

    private static let minute: Double = 60_000
    private static let day: Double = 24 * 60 * 60_000

    init(appName: String, showsNews: Bool = true, onNotice: @escaping @Sendable (Notice) -> Void) {
        self.appName = appName
        self.onNotice = onNotice
        let t0 = Date().timeIntervalSince1970 * 1000
        let M = Self.minute, D = Self.day
        func seed(_ n: Int, _ title: String, _ body: String, _ votes: Int, _ status: RequestStatus, shipNote: String? = nil,
                  shippedAt: Double? = nil, creditName: String? = nil, mine: Bool = false, voted: Bool = false, comments: [RequestComment] = []) -> Stored {
            Stored(r: FeatureRequest(id: "demo_\(n)", number: n, title: title, body: body, status: status, votes: votes, comments: comments.count,
                                     shipNote: shipNote, shippedAt: shippedAt, creditName: creditName,
                                     createdAt: t0 - Double(20 - n) * D, voted: voted, mine: mine), comments: comments)
        }
        func team(_ id: String, _ body: String, _ ago: Double) -> RequestComment {
            RequestComment(id: id, body: body, team: true, author: nil, mine: false, createdAt: t0 - ago)
        }
        store = [
            seed(12, "Split a bill with my partner", "We share groceries and rent. Would love to tag an expense as 50/50 and see who owes who.", 14, .planned, comments: [
                RequestComment(id: "c1", body: "Yes! Even just splitting one expense would help.", team: false, author: "Raj", mine: false, createdAt: t0 - 3 * D),
                team("c2", "On the list for December. Would a simple “who owes who” total be enough to start?", 2 * D),
            ]),
            seed(13, "Monthly budget per category", "Set $400 for food and get a heads-up when I'm close.", 11, .inProgress),
            seed(7, "Dark mode for the charts", "", 8, .shipped, shipNote: "Charts now follow your theme. Settings → Appearance.", shippedAt: t0 - 2 * D, creditName: "Sam"),
            seed(14, "Import my bank statement PDF", "Some of my older expenses never came through email.", 6, .open),
            seed(15, "Recurring expenses (Netflix, rent)", "", 4, .open),
            seed(16, "Widget for the home screen", "Just today's total would be enough.", 3, .open),
            seed(9, "Show which card I paid with", "", 5, .shipped, shipNote: "Each expense now shows the card's last 4 digits.", shippedAt: t0 - 4 * M, mine: true, voted: true),
            seed(17, "Export expenses to Excel", "For my accountant at tax time.", 2, .open, mine: true, voted: true,
                 comments: [team("c3", "Good one. Would a CSV that opens in Excel work, or do you need .xlsx?", 3 * M)]),
        ]
        let shippedMine = store.filter { $0.r.status == .shipped }
        // One win the person asked for, outside the "what's new" list, so the demo shows the "it's live" card too.
        let live = seed(11, "Pin my favourite categories", "", 9, .shipped, shipNote: "Long-press a category to pin it to the top.", shippedAt: t0 - 60 * M, mine: true, voted: true)
        store.append(live)
        let items = shippedMine
            .sorted { ($0.r.mine ? 1 : 0, $0.r.shippedAt ?? 0) > ($1.r.mine ? 1 : 0, $1.r.shippedAt ?? 0) }
            .map { WhatsNew.Item(id: $0.r.id, title: $0.r.title, shipNote: $0.r.shipNote, shippedAt: $0.r.shippedAt ?? t0, mine: $0.r.mine) }
        configValue = Config(
            app: .init(name: appName), watermark: false, identified: true, canCredit: true,
            unseen: showsNews ? [Notice(id: "demo_n1", kind: "shipped", requestId: live.r.id, title: live.r.title, shipNote: live.r.shipNote)] : [],
            whatsNew: showsNews ? WhatsNew(items: items, total: shippedMine.count) : nil,
            nudge: NudgeSettings(everyDays: 7, activeSeconds: 30, skipVisits: 1, message: nil, position: .bottom))
    }

    private nonisolated func wait(_ ms: Double = 380) async {
        try? await Task.sleep(nanoseconds: UInt64((ms + Double.random(in: 0...(ms * 0.5))) * 1_000_000))
    }

    private func view(_ s: Stored) -> FeatureRequest {
        var r = s.r
        r.comments = s.comments.count
        return r
    }

    private func index(_ id: String) -> Int? { store.firstIndex { $0.r.id == id } }

    private static func words(_ s: String) -> Set<String> {
        Set(s.lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init).filter { $0.count > 2 })
    }

    private let teamReplies = [
        "Thanks, this is useful. We've added it to the board. Roughly how often would you use it?",
        "Love this one. Can you tell us what you do today instead?",
        "Noted! The more votes it gets, the sooner it moves up.",
    ]

    private func scheduleReply(_ id: String, delay: Double) {
        guard !answered.contains(id) else { return }
        answered.insert(id)
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            await self?.deliverReply(id)
        }
    }

    private func deliverReply(_ id: String) {
        seq += 1
        let c = RequestComment(id: "demo_c\(seq)", body: teamReplies[seq % teamReplies.count], team: true, author: nil, mine: false, createdAt: Date().timeIntervalSince1970 * 1000)
        guard let i = index(id) else { return }
        store[i].comments.append(c)
        seq += 1
        onNotice(Notice(id: "demo_n\(seq)", kind: "reply", requestId: id, title: store[i].r.title, reply: c.body))
    }

    func config() async throws -> Config { await wait(200); return configValue }

    func list(sort: String, status: String) async throws -> [FeatureRequest] {
        await wait()
        let active: [RequestStatus] = [.open, .planned, .inProgress]
        var rows = store.filter { status == "all" ? true : status == "shipped" ? $0.r.status == .shipped : active.contains($0.r.status) }
        rows.sort { a, b in
            if status == "shipped" { return (a.r.shippedAt ?? 0) > (b.r.shippedAt ?? 0) }
            if sort == "new" { return a.r.createdAt > b.r.createdAt }
            return a.r.votes != b.r.votes ? a.r.votes > b.r.votes : a.r.createdAt > b.r.createdAt
        }
        return rows.map(view)
    }

    func similar(_ q: String) async throws -> [FeatureRequest] {
        await wait(250)
        let words = Self.words(q)
        guard !words.isEmpty else { return [] }
        return store
            .filter { $0.r.status != .declined }
            .map { s -> (Stored, Int) in
                let w = Self.words(s.r.title)
                return (s, w.filter { words.contains($0) }.count)
            }
            .filter { $0.1 >= 2 || ($0.1 == 1 && Self.words($0.0.r.title).count <= 2) }
            .sorted { $0.1 > $1.1 }
            .prefix(3)
            .map { view($0.0) }
    }

    func get(_ id: String) async throws -> RequestDetail {
        await wait()
        guard let i = index(id) else { throw YouAskedError("not_found") }
        let s = store[i]
        let othersJoined = s.r.votes > (s.r.mine && s.r.voted ? 1 : 0) || s.comments.contains { !$0.mine }
        return RequestDetail(request: view(s), comments: s.comments, attachments: s.attachments, earlyAccess: s.early,
                             canDelete: s.r.mine && s.r.status == .open && !othersJoined, redirect: nil)
    }

    func remove(_ id: String) async throws {
        await wait()
        if let i = index(id) { store.remove(at: i) }
    }

    func create(_ input: NewRequest) async throws -> CreatedRequest {
        await wait(650)
        seq += 1
        let atts = (input.attachments ?? []).compactMap { uploads[$0] }
        let r = FeatureRequest(id: "demo_\(seq)", number: 20 + store.count, title: input.title, body: input.body == input.title ? "" : input.body,
                               status: .open, votes: 1, context: input.context, createdAt: Date().timeIntervalSince1970 * 1000, voted: true, mine: true)
        store.insert(Stored(r: r, attachments: atts), at: 0)
        scheduleReply(r.id, delay: 5.2)
        return CreatedRequest(request: r, attachments: atts)
    }

    func upload(_ data: Data, contentType: String) async throws -> Attachment {
        await wait(300)
        seq += 1
        let a = Attachment(id: "demo_up\(seq)", url: "data:\(contentType);base64,\(data.base64EncodedString())")
        uploads[a.id] = a
        return a
    }

    func vote(_ id: String) async throws -> VoteResult {
        await wait(180)
        guard let i = index(id) else { throw YouAskedError("not_found") }
        store[i].r.voted.toggle()
        store[i].r.votes += store[i].r.voted ? 1 : -1
        return VoteResult(voted: store[i].r.voted, votes: store[i].r.votes)
    }

    func comment(_ id: String, body: String) async throws -> RequestComment {
        await wait(300)
        guard let i = index(id) else { throw YouAskedError("not_found") }
        seq += 1
        let c = RequestComment(id: "demo_c\(seq)", body: body, team: false, author: "You", mine: true, createdAt: Date().timeIntervalSince1970 * 1000)
        store[i].comments.append(c)
        let mine = store[i].r.mine
        if mine { scheduleReply(id, delay: 3.8) }
        return c
    }

    func earlyAccess(_ id: String) async throws -> Bool {
        await wait(200)
        guard let i = index(id) else { throw YouAskedError("not_found") }
        store[i].early.toggle()
        return store[i].early
    }

    func mine() async throws -> [FeatureRequest] {
        await wait()
        return store.filter { $0.r.mine || $0.r.voted }.map(view)
    }

    func seen(_ ids: [String]) async throws {}
    func whatsNewSeen() async throws {}
}
