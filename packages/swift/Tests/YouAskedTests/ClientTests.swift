import XCTest
@testable import YouAsked

final class ClientTests: XCTestCase {
    func testBase64URL() {
        XCTAssertEqual(Base64URL.encode(""), "")
        XCTAssertEqual(Base64URL.encode("f"), "Zg")          // no padding
        XCTAssertEqual(Base64URL.encode("fo"), "Zm8")
        XCTAssertEqual(Base64URL.encode(Data([0xfb, 0xff, 0xfe])), "-__-")  // + and / become - and _
        XCTAssertEqual(Base64URL.encode("é✓"), "w6ninJM")      // UTF-8, not Latin-1
    }

    func testAnonymousHeaders() throws {
        let c = LiveClient(appKey: "ya_pub_test", anonID: "anon-1234", isDebug: false)
        let h = c.headers(json: false)
        XCTAssertEqual(h["x-youasked-key"], "ya_pub_test")
        XCTAssertEqual(h["x-youasked-anon"], "anon-1234")
        XCTAssertEqual(h["x-youasked-platform"], "ios")
        XCTAssertNil(h["x-youasked-dev"])
        XCTAssertNil(h["x-youasked-user"])
        XCTAssertNil(h["content-type"])
    }

    func testDevHeaderOnlyInDebug() {
        XCTAssertEqual(LiveClient(appKey: "k", anonID: "a", isDebug: true).headers(json: true)["x-youasked-dev"], "1")
        XCTAssertNil(LiveClient(appKey: "k", anonID: "a", isDebug: false).headers(json: true)["x-youasked-dev"])
        XCTAssertEqual(LiveClient(appKey: "k", anonID: "a", isDebug: true).headers(json: true)["content-type"], "application/json")
    }

    func testUserHeaders() throws {
        let c = LiveClient(appKey: "k", user: YouAskedUser(id: "u/1", email: nil, name: "Sam é"), signature: "abc123", anonID: "a", isDebug: false)
        let h = c.headers(json: false)
        XCTAssertEqual(h["x-youasked-sig"], "abc123")
        var b64 = try XCTUnwrap(h["x-youasked-user"]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while b64.count % 4 != 0 { b64 += "=" }
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: try XCTUnwrap(Data(base64Encoded: b64))) as? [String: Any])
        XCTAssertEqual(json["id"] as? String, "u/1")
        XCTAssertEqual(json["name"] as? String, "Sam é")
        XCTAssertNil(json["email"])
    }

    func testNoSignatureWithoutUserAndNoUserWithEmptyId() {
        XCTAssertNil(LiveClient(appKey: "k", signature: "sig", anonID: "a", isDebug: false).headers(json: false)["x-youasked-sig"])
        XCTAssertNil(LiveClient(appKey: "k", user: YouAskedUser(id: ""), signature: "sig", anonID: "a", isDebug: false).headers(json: false)["x-youasked-user"])
    }

    func testRequestURLsAndMethods() throws {
        let c = LiveClient(appKey: "k", apiURL: URL(string: "https://example.com/")!, anonID: "a", isDebug: false)
        XCTAssertEqual(try c.makeRequest("/config").url?.absoluteString, "https://example.com/v1/config")
        XCTAssertEqual(try c.makeRequest("/config").httpMethod, "GET")
        XCTAssertEqual(try c.makeRequest("/x", json: Data("{}".utf8)).httpMethod, "POST")
        XCTAssertEqual(try c.makeRequest("/x", method: "DELETE").httpMethod, "DELETE")
        XCTAssertEqual(try c.makeRequest("/uploads", raw: (Data([1]), "image/png")).value(forHTTPHeaderField: "content-type"), "image/png")
        XCTAssertEqual(LiveClient.encodeComponent("a b&c+d/é"), "a%20b%26c%2Bd%2F%C3%A9")
    }

    // MARK: errors, through a stubbed URLSession

    final class Stub: URLProtocol {
        nonisolated(unsafe) static var status = 200
        nonisolated(unsafe) static var body = "{}"
        nonisolated(unsafe) static var seen: URLRequest?
        override class func canInit(with request: URLRequest) -> Bool { true }
        override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
        override func startLoading() {
            Stub.seen = request
            client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: Stub.status, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(Stub.body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        }
        override func stopLoading() {}
    }

    private func stubbed() -> LiveClient {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.protocolClasses = [Stub.self]
        return LiveClient(appKey: "k", anonID: "a", isDebug: false, session: URLSession(configuration: cfg))
    }

    func testTestModeIsItsOwnError() async {
        Stub.status = 402; Stub.body = #"{"error":"test_mode"}"#
        do { _ = try await stubbed().config(); XCTFail("should throw") } catch { XCTAssertEqual(error as? YouAskedError, .testMode) }
    }

    func testServerCodeAndMessage() async {
        Stub.status = 429; Stub.body = #"{"error":"slow_down","message":"Easy there."}"#
        do { _ = try await stubbed().vote("r1"); XCTFail("should throw") } catch {
            XCTAssertEqual(error as? YouAskedError, YouAskedError("slow_down", detail: "Easy there."))
        }
        Stub.status = 500; Stub.body = "not json"
        do { _ = try await stubbed().mine(); XCTFail("should throw") } catch { XCTAssertEqual((error as? YouAskedError)?.code, "http_500") }
    }

    func testDecodesListAndSendsQuery() async throws {
        Stub.status = 200
        Stub.body = #"{"requests":[{"id":"a","number":3,"title":"T","body":"","status":"in_progress","votes":2,"comments":0,"shipNote":null,"shippedAt":null,"context":null,"creditName":null,"createdAt":1700000000000,"voted":true,"mine":false}]}"#
        let rows = try await stubbed().similar("dark mode & more")
        XCTAssertEqual(rows.first?.status, .inProgress)
        XCTAssertEqual(rows.first?.voted, true)
        XCTAssertEqual(Stub.seen?.url?.query, "q=dark%20mode%20%26%20more")
    }

    func testCreateBodyOmitsNils() async throws {
        Stub.status = 200
        Stub.body = #"{"request":{"id":"a","number":1,"title":"T","body":"","status":"open","votes":1,"comments":0,"createdAt":1,"voted":true,"mine":true}}"#
        let created = try await stubbed().create(NewRequest(title: "T", body: "", context: RequestContext(topic: "charts")))
        XCTAssertEqual(created.request.id, "a")
        let sent = try XCTUnwrap(Stub.seen?.httpBody ?? Stub.seen?.httpBodyStream.map { s -> Data in
            s.open(); defer { s.close() }
            var d = Data(); var buf = [UInt8](repeating: 0, count: 1024)
            while s.hasBytesAvailable { let n = s.read(&buf, maxLength: 1024); if n <= 0 { break }; d.append(buf, count: n) }
            return d
        })
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: sent) as? [String: Any])
        XCTAssertEqual((json["context"] as? [String: String])?["topic"], "charts")
        XCTAssertNil(json["attachments"])
        XCTAssertNil(json["credit"])
    }

    // MARK: theme and nudge

    func testColorParsing() {
        XCTAssertEqual(RGBA(css: "#2B4BEE"), RGBA(43, 75, 238))
        XCTAssertEqual(RGBA(css: "#fff"), RGBA(255, 255, 255))
        XCTAssertEqual(RGBA(css: "rgb(10, 20, 30)"), RGBA(10, 20, 30))
        XCTAssertEqual(RGBA(css: "hsl(0, 100%, 50%)"), RGBA(255, 0, 0))
        XCTAssertNil(RGBA(css: "nope"))
    }

    func testThemeDerivesFromAccent() {
        XCTAssertTrue(Theme.resolve(.default, scheme: .dark).dark)
        XCTAssertFalse(Theme.resolve(Appearance(mode: .light), scheme: .dark).dark)
        XCTAssertTrue(Theme.resolve(Appearance(mode: .dark), scheme: .light).dark)
        XCTAssertEqual(Theme.resolve(Appearance(buttonRadius: .pill), scheme: .light).buttonRadius, 999)
        XCTAssertEqual(Theme.resolve(Appearance(buttonRadius: 12), scheme: .light).buttonRadius, 12)
        XCTAssertNil(Theme.resolve(.default, scheme: .light).buttonRadius)
    }

    func testNudgeSchedule() {
        let day = NudgeLogic.day
        let s = NudgeSettings(everyDays: 7, activeSeconds: 30, skipVisits: 1)
        let now = 100 * day
        // First visit is skipped, second is allowed.
        var m = NudgeLogic.countVisit(NudgeMemory(), now: now)
        XCTAssertFalse(NudgeLogic.isDue(m, settings: s, now: now))
        m = NudgeLogic.countVisit(m, now: now + NudgeLogic.visitGap + 1)
        XCTAssertEqual(m.visits, 2)
        XCTAssertTrue(NudgeLogic.isDue(m, settings: s, now: now + day))
        // Same visit (inside the gap) doesn't count twice.
        XCTAssertEqual(NudgeLogic.countVisit(m, now: now + NudgeLogic.visitGap + 60_000).visits, 2)
        // Never twice within the interval, and each dismissal doubles the wait (capped at 8x).
        m.lastShownAt = now
        XCTAssertFalse(NudgeLogic.isDue(m, settings: s, now: now + 6 * day))
        XCTAssertTrue(NudgeLogic.isDue(m, settings: s, now: now + 7 * day))
        m.dismissals = 1
        XCTAssertFalse(NudgeLogic.isDue(m, settings: s, now: now + 13 * day))
        XCTAssertTrue(NudgeLogic.isDue(m, settings: s, now: now + 14 * day))
        m.dismissals = 9
        XCTAssertFalse(NudgeLogic.isDue(m, settings: s, now: now + 55 * day))
        XCTAssertTrue(NudgeLogic.isDue(m, settings: s, now: now + 56 * day))
        // Opening the sheet recently holds it back too.
        m.dismissals = 0; m.lastShownAt = 0; m.lastEngagedAt = now
        XCTAssertFalse(NudgeLogic.isDue(m, settings: s, now: now + 3 * day))
        // Resolving: off wins, custom overrides the dashboard, automatic follows the server.
        XCTAssertNil(NudgeLogic.resolve(server: s, option: .off))
        XCTAssertNil(NudgeLogic.resolve(server: nil, option: .automatic))
        XCTAssertEqual(NudgeLogic.resolve(server: nil, option: .on), .defaults)
        XCTAssertEqual(NudgeLogic.resolve(server: s, option: .custom(NudgeSettings(everyDays: 1)))?.everyDays, 1)
    }

    func testRoutes() {
        XCTAssertEqual(YAModel.route(view: nil, requestId: "x", draft: nil, topic: nil, placeholder: nil), .detail(id: "x", from: nil))
        XCTAssertEqual(YAModel.route(view: nil, requestId: nil, draft: nil, topic: "charts", placeholder: nil),
                       .home(draft: nil, focus: true, topic: "charts", placeholder: "What would make charts better?"))
        XCTAssertEqual(YAModel.route(view: .new, requestId: nil, draft: "Q", topic: "search", placeholder: nil),
                       .home(draft: "Q", focus: true, topic: "search", placeholder: nil))
        XCTAssertEqual(YAModel.route(view: .shipped, requestId: nil, draft: nil, topic: nil, placeholder: nil), .board(tab: .shipped))
    }
}
