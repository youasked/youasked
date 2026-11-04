import Foundation

public let defaultAPIURL = URL(string: "https://api.youasked.dev")!

/// What the UI talks to. The live client and the demo both implement it.
protocol YouAskedAPI: Sendable {
    func config() async throws -> Config
    func list(sort: String, status: String) async throws -> [FeatureRequest]
    func similar(_ q: String) async throws -> [FeatureRequest]
    func get(_ id: String) async throws -> RequestDetail
    func create(_ input: NewRequest) async throws -> CreatedRequest
    func upload(_ data: Data, contentType: String) async throws -> Attachment
    func remove(_ id: String) async throws
    func earlyAccess(_ id: String) async throws -> Bool
    func whatsNewSeen() async throws
    func vote(_ id: String) async throws -> VoteResult
    func comment(_ id: String, body: String) async throws -> RequestComment
    func mine() async throws -> [FeatureRequest]
    func seen(_ ids: [String]) async throws
}

enum Base64URL {
    /// Base64 with `-` and `_` for `+` and `/`, and no padding.
    static func encode(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
    static func encode(_ text: String) -> String { encode(Data(text.utf8)) }
}

/// The real HTTP client. Mirrors packages/react-native/src/client.ts.
final class LiveClient: YouAskedAPI, @unchecked Sendable {
    let appKey: String
    let base: String
    let user: YouAskedUser?
    let signature: String?
    let anonID: String
    let isDebug: Bool
    private let session: URLSession

    init(appKey: String, apiURL: URL = defaultAPIURL, user: YouAskedUser? = nil, signature: String? = nil,
         anonID: String = AnonID.current, isDebug: Bool = LiveClient.debugBuild, session: URLSession = .shared) {
        self.appKey = appKey
        self.base = apiURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/v1"
        self.user = user
        self.signature = signature
        self.anonID = anonID
        self.isDebug = isDebug
        self.session = session
    }

    static var debugBuild: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }

    /// The headers for one call. `json` adds the content type for a JSON body.
    func headers(json: Bool) -> [String: String] {
        var h: [String: String] = [
            "x-youasked-key": appKey,
            "x-youasked-anon": anonID,
            // Native apps send no Origin header, so say who is calling (and whether it's a dev build).
            "x-youasked-platform": "ios",
        ]
        if isDebug { h["x-youasked-dev"] = "1" }
        if let user, !user.id.isEmpty {
            h["x-youasked-user"] = Self.userHeader(user)
            if let signature, !signature.isEmpty { h["x-youasked-sig"] = signature }
        }
        if json { h["content-type"] = "application/json" }
        return h
    }

    static func userHeader(_ user: YouAskedUser) -> String {
        struct Payload: Encodable { var id: String; var email: String?; var name: String? }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.withoutEscapingSlashes]
        let data = (try? encoder.encode(Payload(id: user.id, email: user.email, name: user.name))) ?? Data()
        return Base64URL.encode(data)
    }

    static func encodeComponent(_ s: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-_.!~*'()")
        return s.addingPercentEncoding(withAllowedCharacters: allowed) ?? s
    }

    func makeRequest(_ path: String, method: String? = nil, json: Data? = nil, raw: (Data, String)? = nil) throws -> URLRequest {
        guard let url = URL(string: base + path) else { throw YouAskedError("bad_url") }
        var req = URLRequest(url: url)
        req.httpMethod = method ?? (json == nil && raw == nil ? "GET" : "POST")
        req.timeoutInterval = 30
        for (k, v) in headers(json: json != nil && raw == nil) { req.setValue(v, forHTTPHeaderField: k) }
        if let raw {
            req.setValue(raw.1, forHTTPHeaderField: "content-type")
            req.httpBody = raw.0
        } else if let json {
            req.httpBody = json
        }
        return req
    }

    private struct ErrorBody: Decodable { var error: String?; var message: String? }

    private func send<T: Decodable>(_ req: URLRequest, as: T.Type = T.self) async throws -> T {
        let data: Data
        let res: URLResponse
        do {
            (data, res) = try await session.data(for: req)
        } catch {
            if error is CancellationError || (error as? URLError)?.code == .cancelled { throw error }
            throw YouAskedError("network")
        }
        let status = (res as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let body = try? JSONDecoder().decode(ErrorBody.self, from: data)
            let code = body?.error
            throw YouAskedError(status == 402 && code == "test_mode" ? "test_mode" : (code ?? "http_\(status)"), detail: body?.message)
        }
        do { return try JSONDecoder().decode(T.self, from: data) } catch { throw YouAskedError("bad_response") }
    }

    private func call<T: Decodable>(_ path: String, method: String? = nil, body: (any Encodable)? = nil, as: T.Type = T.self) async throws -> T {
        let json = try body.map { try JSONEncoder().encode(AnyEncodable($0)) }
        return try await send(try makeRequest(path, method: method, json: json))
    }

    private struct AnyEncodable: Encodable {
        let value: any Encodable
        init(_ v: any Encodable) { value = v }
        func encode(to encoder: Encoder) throws { try value.encode(to: encoder) }
    }
    private struct Empty: Codable {}
    private struct OK: Decodable { var ok: Bool? }
    private struct Requests: Decodable { var requests: [FeatureRequest] }

    func config() async throws -> Config { try await call("/config") }

    func list(sort: String, status: String) async throws -> [FeatureRequest] {
        try await call("/requests?sort=\(sort)&status=\(status)", as: Requests.self).requests
    }

    func similar(_ q: String) async throws -> [FeatureRequest] {
        try await call("/requests/similar?q=\(Self.encodeComponent(q))", as: Requests.self).requests
    }

    func get(_ id: String) async throws -> RequestDetail { try await call("/requests/\(Self.encodeComponent(id))") }

    func create(_ input: NewRequest) async throws -> CreatedRequest {
        struct Res: Decodable { var request: FeatureRequest; var attachments: [Attachment]? }
        let r: Res = try await call("/requests", body: input)
        return CreatedRequest(request: r.request, attachments: r.attachments ?? [])
    }

    func upload(_ data: Data, contentType: String) async throws -> Attachment {
        try await send(try makeRequest("/uploads", raw: (data, contentType.isEmpty ? "image/png" : contentType)))
    }

    func remove(_ id: String) async throws {
        _ = try await call("/requests/\(Self.encodeComponent(id))", method: "DELETE", as: OK.self)
    }

    func earlyAccess(_ id: String) async throws -> Bool {
        struct Res: Decodable { var earlyAccess: Bool }
        return try await call("/requests/\(Self.encodeComponent(id))/early-access", body: Empty(), as: Res.self).earlyAccess
    }

    func whatsNewSeen() async throws { _ = try await call("/whats-new/seen", body: Empty(), as: OK.self) }

    func vote(_ id: String) async throws -> VoteResult {
        try await call("/requests/\(Self.encodeComponent(id))/vote", body: Empty())
    }

    func comment(_ id: String, body: String) async throws -> RequestComment {
        struct Req: Encodable { var body: String }
        struct Res: Decodable { var comment: RequestComment }
        return try await call("/requests/\(Self.encodeComponent(id))/comments", body: Req(body: body), as: Res.self).comment
    }

    func mine() async throws -> [FeatureRequest] { try await call("/me/requests", as: Requests.self).requests }

    func seen(_ ids: [String]) async throws {
        struct Req: Encodable { var ids: [String] }
        _ = try await call("/notifications/seen", body: Req(ids: ids), as: OK.self)
    }
}

/// One random id per install. It is what ties an anonymous person's votes and requests to their device.
enum AnonID {
    static let key = "youasked:anon"
    static var current: String {
        let defaults = UserDefaults.standard
        if let existing = defaults.string(forKey: key), !existing.isEmpty { return existing }
        let id = UUID().uuidString.lowercased()
        defaults.set(id, forKey: key)
        return id
    }
}
