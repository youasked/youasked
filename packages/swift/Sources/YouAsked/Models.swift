import Foundation

public enum RequestStatus: String, Codable, Sendable, Hashable {
    case open, planned
    case inProgress = "in_progress"
    case shipped, declined

    var label: String {
        switch self {
        case .open: return "Open"
        case .planned: return "Planned"
        case .inProgress: return "In progress"
        case .shipped: return "Shipped"
        case .declined: return "Not planned"
        }
    }

    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = RequestStatus(rawValue: raw) ?? .open
    }
}

public struct RequestContext: Codable, Sendable, Hashable {
    public var path: String?
    public var topic: String?
    public init(path: String? = nil, topic: String? = nil) {
        self.path = path
        self.topic = topic
    }
}

public struct FeatureRequest: Codable, Sendable, Hashable, Identifiable {
    public var id: String
    /// Shown as YA-12; commits and PRs that say "closes YA-12" ship it.
    public var number: Int
    public var title: String
    public var body: String
    public var status: RequestStatus
    public var votes: Int
    public var comments: Int
    public var shipNote: String?
    /// Milliseconds since 1970.
    public var shippedAt: Double?
    public var context: RequestContext?
    /// First name of the person who asked, when they opted in to being thanked and it has shipped.
    public var creditName: String?
    public var createdAt: Double
    public var voted: Bool
    public var mine: Bool

    public init(id: String, number: Int, title: String, body: String = "", status: RequestStatus = .open, votes: Int = 0,
                comments: Int = 0, shipNote: String? = nil, shippedAt: Double? = nil, context: RequestContext? = nil,
                creditName: String? = nil, createdAt: Double = Date().timeIntervalSince1970 * 1000, voted: Bool = false, mine: Bool = false) {
        self.id = id; self.number = number; self.title = title; self.body = body; self.status = status; self.votes = votes
        self.comments = comments; self.shipNote = shipNote; self.shippedAt = shippedAt; self.context = context
        self.creditName = creditName; self.createdAt = createdAt; self.voted = voted; self.mine = mine
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        number = try c.decodeIfPresent(Int.self, forKey: .number) ?? 0
        title = try c.decode(String.self, forKey: .title)
        body = try c.decodeIfPresent(String.self, forKey: .body) ?? ""
        status = try c.decodeIfPresent(RequestStatus.self, forKey: .status) ?? .open
        votes = try c.decodeIfPresent(Int.self, forKey: .votes) ?? 0
        comments = try c.decodeIfPresent(Int.self, forKey: .comments) ?? 0
        shipNote = try c.decodeIfPresent(String.self, forKey: .shipNote)
        shippedAt = try c.decodeIfPresent(Double.self, forKey: .shippedAt)
        context = try? c.decodeIfPresent(RequestContext.self, forKey: .context)
        creditName = try c.decodeIfPresent(String.self, forKey: .creditName)
        createdAt = try c.decodeIfPresent(Double.self, forKey: .createdAt) ?? 0
        voted = try c.decodeIfPresent(Bool.self, forKey: .voted) ?? false
        mine = try c.decodeIfPresent(Bool.self, forKey: .mine) ?? false
    }
}

public struct Attachment: Codable, Sendable, Hashable {
    public var id: String
    public var url: String
}

/// What shipped since this person was last shown the list.
public struct WhatsNew: Codable, Sendable, Hashable {
    public struct Item: Codable, Sendable, Hashable, Identifiable {
        public var id: String
        public var title: String
        public var shipNote: String?
        public var shippedAt: Double
        public var mine: Bool
        public init(id: String, title: String, shipNote: String?, shippedAt: Double, mine: Bool) {
            self.id = id; self.title = title; self.shipNote = shipNote; self.shippedAt = shippedAt; self.mine = mine
        }
        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            title = try c.decode(String.self, forKey: .title)
            shipNote = try c.decodeIfPresent(String.self, forKey: .shipNote)
            shippedAt = try c.decodeIfPresent(Double.self, forKey: .shippedAt) ?? 0
            mine = try c.decodeIfPresent(Bool.self, forKey: .mine) ?? false
        }
    }
    /// Items shown, newest first with the ones they asked for or voted on at the top.
    public var items: [Item]
    /// How many shipped in all; more than `items.count` when the list was cut short.
    public var total: Int
    public init(items: [Item], total: Int) { self.items = items; self.total = total }
}

public struct RequestComment: Codable, Sendable, Hashable, Identifiable {
    public var id: String
    public var body: String
    public var team: Bool
    public var author: String?
    public var mine: Bool
    public var createdAt: Double
    public init(id: String, body: String, team: Bool, author: String?, mine: Bool, createdAt: Double) {
        self.id = id; self.body = body; self.team = team; self.author = author; self.mine = mine; self.createdAt = createdAt
    }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        body = try c.decode(String.self, forKey: .body)
        team = try c.decodeIfPresent(Bool.self, forKey: .team) ?? false
        author = try c.decodeIfPresent(String.self, forKey: .author)
        mine = try c.decodeIfPresent(Bool.self, forKey: .mine) ?? false
        createdAt = try c.decodeIfPresent(Double.self, forKey: .createdAt) ?? 0
    }
}

public struct Notice: Codable, Sendable, Hashable, Identifiable {
    public var id: String
    /// "shipped", or "reply" when the team answered.
    public var kind: String
    public var requestId: String
    public var title: String
    public var shipNote: String?
    public var reply: String?
    public init(id: String, kind: String, requestId: String, title: String, shipNote: String? = nil, reply: String? = nil) {
        self.id = id; self.kind = kind; self.requestId = requestId; self.title = title; self.shipNote = shipNote; self.reply = reply
    }
}

/// The occasional "Got an idea for <App>?" prompt, tuned in the dashboard.
public struct NudgeSettings: Codable, Sendable, Hashable {
    /// Show at most once every this many days.
    public var everyDays: Double
    /// Seconds someone must have the app open in this visit before it shows.
    public var activeSeconds: Double
    /// Visits to skip before the first prompt, so brand-new people get to look around.
    public var skipVisits: Int
    /// Headline. Defaults to "Got an idea for <App>?".
    public var message: String?
    public var position: Position

    public enum Position: String, Codable, Sendable { case bottom, top }

    public static let defaults = NudgeSettings()

    public init(everyDays: Double = 7, activeSeconds: Double = 30, skipVisits: Int = 1, message: String? = nil, position: Position = .bottom) {
        self.everyDays = everyDays; self.activeSeconds = activeSeconds; self.skipVisits = skipVisits
        self.message = message; self.position = position
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = NudgeSettings.defaults
        everyDays = try c.decodeIfPresent(Double.self, forKey: .everyDays) ?? d.everyDays
        activeSeconds = try c.decodeIfPresent(Double.self, forKey: .activeSeconds) ?? d.activeSeconds
        skipVisits = try c.decodeIfPresent(Int.self, forKey: .skipVisits) ?? d.skipVisits
        message = try c.decodeIfPresent(String.self, forKey: .message)
        position = (try? c.decodeIfPresent(Position.self, forKey: .position)) ?? d.position
    }
}

public struct Config: Codable, Sendable {
    public struct App: Codable, Sendable { public var name: String }
    public var app: App
    public var watermark: Bool
    public var identified: Bool
    /// Identified with a name, so "Credit me when it ships" makes sense.
    public var canCredit: Bool
    public var unseen: [Notice]
    public var whatsNew: WhatsNew?
    /// Nil when the nudge is off in the dashboard.
    public var nudge: NudgeSettings?

    public init(app: App, watermark: Bool = false, identified: Bool = false, canCredit: Bool = false, unseen: [Notice] = [],
                whatsNew: WhatsNew? = nil, nudge: NudgeSettings? = nil) {
        self.app = app; self.watermark = watermark; self.identified = identified; self.canCredit = canCredit
        self.unseen = unseen; self.whatsNew = whatsNew; self.nudge = nudge
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        app = try c.decode(App.self, forKey: .app)
        watermark = try c.decodeIfPresent(Bool.self, forKey: .watermark) ?? false
        identified = try c.decodeIfPresent(Bool.self, forKey: .identified) ?? false
        canCredit = try c.decodeIfPresent(Bool.self, forKey: .canCredit) ?? false
        unseen = try c.decodeIfPresent([Notice].self, forKey: .unseen) ?? []
        whatsNew = try? c.decodeIfPresent(WhatsNew.self, forKey: .whatsNew)
        nudge = try? c.decodeIfPresent(NudgeSettings.self, forKey: .nudge)
    }
}

public struct NewRequest: Codable, Sendable {
    public var title: String
    public var body: String
    /// Ids from `upload`.
    public var attachments: [String]?
    public var context: RequestContext?
    public var credit: Bool?
    public init(title: String, body: String, attachments: [String]? = nil, context: RequestContext? = nil, credit: Bool? = nil) {
        self.title = title; self.body = body; self.attachments = attachments; self.context = context; self.credit = credit
    }
}

public struct RequestDetail: Codable, Sendable {
    public var request: FeatureRequest?
    public var comments: [RequestComment]?
    public var attachments: [Attachment]?
    /// Whether this person asked to try it before it ships.
    public var earlyAccess: Bool?
    /// The person wrote it and nobody else has joined in yet, so they can take it back.
    public var canDelete: Bool?
    public var redirect: String?
}

public struct CreatedRequest: Sendable {
    public var request: FeatureRequest
    public var attachments: [Attachment]
}

public struct VoteResult: Codable, Sendable, Equatable {
    public var voted: Bool
    public var votes: Int
}

/// Who is asking. Pair it with a signature your server makes (see the README).
public struct YouAskedUser: Sendable, Hashable {
    public var id: String
    public var email: String?
    public var name: String?
    public init(id: String, email: String? = nil, name: String? = nil) {
        self.id = id; self.email = email; self.name = name
    }
    public init(id: Int, email: String? = nil, name: String? = nil) {
        self.init(id: String(id), email: email, name: name)
    }
}

public struct YouAskedError: Error, Equatable, LocalizedError, Sendable {
    /// `network`, `test_mode`, `http_<status>`, or the server's own code such as `slow_down`.
    public var code: String
    /// A ready-to-show sentence from the server, when it sent one (spam, rate limits, delete).
    public var detail: String?
    public init(_ code: String, detail: String? = nil) { self.code = code; self.detail = detail }
    public var errorDescription: String? { detail ?? code }
    public static let testMode = YouAskedError("test_mode")
}
