import Foundation

/// How the occasional "Got an idea for <App>?" prompt is decided.
public enum NudgeOption: Sendable {
    /// Use what the dashboard says (off unless you turned it on there). The default.
    case automatic
    /// Never show it, whatever the dashboard says.
    case off
    /// On, with the dashboard's settings or the defaults.
    case on
    /// On, with your own settings instead of the dashboard's.
    case custom(NudgeSettings)
}

struct NudgeMemory: Codable, Equatable {
    var visits = 0
    var lastVisitAt: Double = 0
    var lastShownAt: Double = 0
    var lastEngagedAt: Double = 0
    var dismissals = 0
}

enum NudgeLogic {
    static let day: Double = 24 * 60 * 60 * 1000
    /// A new visit starts after this long away.
    static let visitGap: Double = 30 * 60 * 1000

    /// What the developer asked for: `.off` turns it off, `.custom` overrides the dashboard settings.
    static func resolve(server: NudgeSettings?, option: NudgeOption) -> NudgeSettings? {
        switch option {
        case .off: return nil
        case .custom(let s): return s
        case .on: return server ?? .defaults
        case .automatic: return server
        }
    }

    /// Counts this visit. A visit is a launch, or a return after `visitGap` away.
    static func countVisit(_ m: NudgeMemory, now: Double) -> NudgeMemory {
        var m = m
        if now - m.lastVisitAt > visitGap { m.visits += 1 }
        m.lastVisitAt = now
        return m
    }

    /// Whether this person is due a prompt. With no memory (the demo) the active time is enough.
    static func isDue(_ m: NudgeMemory?, settings: NudgeSettings, now: Double) -> Bool {
        guard let m else { return true }
        let wait = settings.everyDays * day * pow(2, Double(min(m.dismissals, 3)))
        return m.visits > settings.skipVisits && now - m.lastShownAt >= wait && now - m.lastEngagedAt >= wait
    }
}

struct NudgeStore {
    let key: String?
    func load() -> NudgeMemory {
        guard let key, let data = UserDefaults.standard.data(forKey: key), let m = try? JSONDecoder().decode(NudgeMemory.self, from: data) else { return NudgeMemory() }
        return m
    }
    func save(_ m: NudgeMemory) {
        guard let key, let data = try? JSONEncoder().encode(m) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }
}
