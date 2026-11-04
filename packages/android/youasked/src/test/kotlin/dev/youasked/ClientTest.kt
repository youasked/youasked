package dev.youasked

import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.IOException

class ClientTest {
    private class Recorded(val method: String, val url: String, val headers: Map<String, String>, val body: String?)

    private fun client(
        user: YouAskedUser? = null,
        sig: String? = null,
        debuggable: Boolean = false,
        reply: (Recorded) -> Pair<Int, String> = { 200 to "{}" },
        log: MutableList<Recorded> = mutableListOf(),
    ) = HttpClient("ya_pub_test", "https://api.example.com/", user, sig, { "anon123" }, debuggable) { m, u, h, b ->
        val r = Recorded(m, u, h, b?.toString(Charsets.UTF_8))
        log.add(r)
        reply(r)
    }

    @Test
    fun base64UrlMatchesRfc4648WithoutPadding() {
        assertEquals("", base64Url(""))
        assertEquals("Zg", base64Url("f"))
        assertEquals("Zm8", base64Url("fo"))
        assertEquals("Zm9v", base64Url("foo"))
        assertEquals("Zm9vYg", base64Url("foob"))
        assertEquals("Zm9vYmE", base64Url("fooba"))
        assertEquals("Zm9vYmFy", base64Url("foobar"))
    }

    @Test
    fun base64UrlUsesUrlSafeAlphabetAndUtf8() {
        // 0xfb 0xff 0xbe would be "+/++" in plain base64; "??>" encodes to Pz8-.
        assertEquals("Pz8-", base64Url("??>"))
        assertEquals("Pz8_", base64Url("???"))
        // "é" is two UTF-8 bytes (c3 a9).
        assertEquals("w6k", base64Url("é"))
        assertFalse(base64Url("a user with / and + and = signs ???").any { it in "+/=" })
    }

    @Test
    fun anonymousHeaders() {
        val h = client().headers(json = false)
        assertEquals("ya_pub_test", h["x-youasked-key"])
        assertEquals("anon123", h["x-youasked-anon"])
        assertEquals("android", h["x-youasked-platform"])
        assertNull(h["x-youasked-dev"])
        assertNull(h["x-youasked-user"])
        assertNull(h["x-youasked-sig"])
        assertNull(h["content-type"])
    }

    @Test
    fun debugBuildsSendTheDevHeader() {
        assertEquals("1", client(debuggable = true).headers(false)["x-youasked-dev"])
    }

    @Test
    fun jsonRequestsSetContentType() {
        assertEquals("application/json", client().headers(true)["content-type"])
    }

    @Test
    fun identifiedUserIsBase64UrlJsonWithSignature() {
        val h = client(YouAskedUser("42", "a@b.co", "Aden é"), "deadbeef").headers(false)
        val decoded = String(java.util.Base64.getUrlDecoder().decode(h["x-youasked-user"]), Charsets.UTF_8)
        val o = JSONObject(decoded)
        assertEquals("42", o.getString("id"))
        assertEquals("a@b.co", o.getString("email"))
        assertEquals("Aden é", o.getString("name"))
        assertEquals("deadbeef", h["x-youasked-sig"])
    }

    @Test
    fun userWithOnlyAnIdOmitsEmailAndName() {
        val h = client(YouAskedUser(7L), null).headers(false)
        val o = JSONObject(String(java.util.Base64.getUrlDecoder().decode(h["x-youasked-user"]), Charsets.UTF_8))
        assertEquals("7", o.getString("id"))
        assertFalse(o.has("email"))
        assertFalse(o.has("name"))
        assertNull(h["x-youasked-sig"])
    }

    @Test
    fun endpointsAndMethods() = runBlocking {
        val log = mutableListOf<Recorded>()
        val c = client(log = log, reply = { r ->
            when {
                r.url.endsWith("/vote") -> 200 to """{"voted":true,"votes":3}"""
                r.url.endsWith("/early-access") -> 200 to """{"earlyAccess":true}"""
                r.url.contains("/requests?") || r.url.contains("/similar") || r.url.endsWith("/me/requests") -> 200 to """{"requests":[]}"""
                else -> 200 to "{}"
            }
        })
        c.list("top", "active")
        c.similar("dark mode & more")
        c.vote("a/b")
        c.earlyAccess("r1")
        c.seen(listOf("n1", "n2"))
        c.whatsNewSeen()
        c.remove("r1")
        c.mine()
        val urls = log.map { it.method + " " + it.url.removePrefix("https://api.example.com/v1") }
        assertEquals(
            listOf(
                "GET /requests?sort=top&status=active",
                "GET /requests/similar?q=dark%20mode%20%26%20more",
                "POST /requests/a%2Fb/vote",
                "POST /requests/r1/early-access",
                "POST /notifications/seen",
                "POST /whats-new/seen",
                "DELETE /requests/r1",
                "GET /me/requests",
            ),
            urls,
        )
        assertEquals("""{"ids":["n1","n2"]}""", log[4].body)
    }

    @Test
    fun voteParsesResult() = runBlocking {
        val r = client(reply = { 200 to """{"voted":true,"votes":3}""" }).vote("x")
        assertTrue(r.voted)
        assertEquals(3, r.votes)
    }

    @Test
    fun testModeIsItsOwnError() = runBlocking {
        val c = client(reply = { 402 to """{"error":"test_mode","message":"hidden"}""" })
        try { c.config(); fail() } catch (e: YouAskedException) {
            assertEquals("test_mode", e.code)
            assertEquals("hidden", e.detail)
        }
    }

    @Test
    fun otherErrorsKeepTheServerCodeOrFallBackToStatus() = runBlocking {
        try { client(reply = { 429 to """{"error":"slow_down"}""" }).config(); fail() } catch (e: YouAskedException) { assertEquals("slow_down", e.code) }
        try { client(reply = { 502 to "<html>bad gateway</html>" }).config(); fail() } catch (e: YouAskedException) { assertEquals("http_502", e.code) }
        try { client(reply = { 402 to """{"error":"payment_required"}""" }).config(); fail() } catch (e: YouAskedException) { assertEquals("payment_required", e.code) }
    }

    @Test
    fun networkFailureBecomesNetworkError() = runBlocking {
        val c = HttpClient("k", "https://x", null, null, { "a" }, false) { _, _, _, _ -> throw IOException("offline") }
        try { c.config(); fail() } catch (e: YouAskedException) { assertEquals("network", e.code) }
    }

    @Test
    fun createSendsTopicAsContextAndParsesRequest() = runBlocking {
        val log = mutableListOf<Recorded>()
        val c = client(log = log, reply = {
            200 to """{"request":{"id":"r9","number":9,"title":"T","body":"","status":"open","votes":1,"comments":0,"shipNote":null,"shippedAt":null,
              "context":{"topic":"charts"},"creditName":null,"createdAt":5,"voted":true,"mine":true},"attachments":[{"id":"a1","url":"https://u"}]}"""
        })
        val (req, att) = c.create(NewRequest("T", "", listOf("a1"), topic = "charts", credit = true))
        val body = JSONObject(log[0].body!!)
        assertEquals("charts", body.getJSONObject("context").getString("topic"))
        assertTrue(body.getBoolean("credit"))
        assertEquals("r9", req.id)
        assertEquals("charts", req.topic)
        assertTrue(req.mine)
        assertEquals("a1", att[0].id)
    }

    @Test
    fun configParsesNudgeNoticesAndWhatsNew() = runBlocking {
        val c = client(reply = {
            200 to """{"app":{"name":"Acme"},"mode":"live","nudge":{"everyDays":3,"activeSeconds":10,"skipVisits":0,"message":null,"position":"top"},
              "watermark":true,"identified":true,"canCredit":true,
              "unseen":[{"id":"n1","kind":"reply","requestId":"r1","title":"T","shipNote":null,"reply":"hi"}],
              "whatsNew":{"total":2,"items":[{"id":"r2","title":"X","shipNote":"n","shippedAt":10,"mine":true}]}}"""
        }).config()
        assertEquals("Acme", c.appName)
        assertEquals(NudgeSettings(3, 10, 0, null, NudgePosition.Top), c.nudge)
        assertEquals("hi", c.unseen[0].reply)
        assertEquals(2, c.whatsNew!!.total)
        assertTrue(c.whatsNew!!.items[0].mine)
    }
}
