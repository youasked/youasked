import XCTest
@testable import YouAsked

/// Runs the real client against the live API in test mode. Skipped unless a key is passed in:
///   TEST_RUNNER_YOUASKED_TEST_KEY=ya_pub_… xcodebuild test …
/// (Debug builds send `x-youasked-dev: 1`, which test mode allows.) Creates one clearly named test request
/// and deletes it again. The key is never printed.
final class LiveAPITests: XCTestCase {
    func testRoundTrip() async throws {
        guard let key = ProcessInfo.processInfo.environment["YOUASKED_TEST_KEY"], !key.isEmpty else {
            throw XCTSkip("YOUASKED_TEST_KEY not set")
        }
        let c = LiveClient(appKey: key, anonID: "swift-sdk-test-" + UUID().uuidString.prefix(8).lowercased())
        XCTAssertTrue(c.isDebug)
        func log(_ s: String) { print("LIVE: \(s)") }

        let config = try await c.config()
        log("config ok app=\(config.app.name) unseen=\(config.unseen.count) nudge=\(config.nudge != nil)")

        let top = try await c.list(sort: "top", status: "active")
        let shipped = try await c.list(sort: "new", status: "shipped")
        log("list ok active=\(top.count) shipped=\(shipped.count)")

        let title = "SDK TEST (swift) please ignore \(UUID().uuidString.prefix(6))"
        let similar = try await c.similar("dark mode charts export")
        log("similar ok matches=\(similar.count)")

        let created = try await c.create(NewRequest(title: title, body: "", context: RequestContext(topic: "sdk-test")))
        log("create ok votes=\(created.request.votes) mine=\(created.request.mine) voted=\(created.request.voted)")
        XCTAssertTrue(created.request.mine)
        let id = created.request.id

        do {
            let v1 = try await c.vote(id)
            log("vote ok voted=\(v1.voted) votes=\(v1.votes)")
            let v2 = try await c.vote(id)
            log("vote toggle ok voted=\(v2.voted) votes=\(v2.votes)")
            XCTAssertNotEqual(v1.voted, v2.voted)

            let comment = try await c.comment(id, body: "SDK test comment")
            XCTAssertTrue(comment.mine)
            log("comment ok")

            let detail = try await c.get(id)
            log("get ok comments=\(detail.comments?.count ?? -1) canDelete=\(detail.canDelete ?? false)")
            XCTAssertEqual(detail.request?.id, id)
            let mine = try await c.mine()
            log("mine ok count=\(mine.count)")
            XCTAssertTrue(mine.contains { $0.id == id })
            try await c.whatsNewSeen()
            try await c.seen([])
            log("seen ok")
        } catch {
            try? await c.remove(id)
            throw error
        }

        try await c.remove(id)
        log("delete ok")
        do { _ = try await c.get(id); XCTFail("should be gone") } catch { log("gone after delete: \((error as? YouAskedError)?.code ?? "?")") }
    }
}
