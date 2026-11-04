package dev.youasked

import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.util.UUID

/**
 * Runs the real client against the live API in test mode (debug builds send x-youasked-dev: 1).
 * Creates one clearly-labelled request and deletes it at the end. Skipped when no key is configured.
 * Run with: ./gradlew :youasked:connectedDebugAndroidTest
 */
class LiveApiTest {
    private fun log(msg: String) = Log.i("YALIVE", msg)

    @Test
    fun configListSimilarCreateVoteCommentDelete() = runBlocking {
        val key = InstrumentationRegistry.getArguments().getString("youaskedKey").orEmpty()
        assumeTrue("no app key in local.properties", key.isNotEmpty())
        val anon = UUID.randomUUID().toString().replace("-", "")
        val client = HttpClient(key, DEFAULT_API_URL, null, null, { anon }, debuggable = true)

        val config = client.config()
        log("config ok: app=${config.appName} identified=${config.identified} unseen=${config.unseen.size} nudge=${config.nudge != null}")
        assertTrue(config.appName.isNotEmpty())

        val top = client.list("top", "active")
        val shipped = client.list("new", "shipped")
        log("list ok: active=${top.size} shipped=${shipped.size}")

        val q = top.firstOrNull()?.title ?: "spending by card"
        val similar = client.similar(q)
        log("similar ok: ${similar.size} matches for an existing title")

        val title = "[YouAsked Android SDK test] please ignore ${anon.take(6)}"
        val (created, _) = client.create(NewRequest(title, "", topic = "sdk-test"))
        log("create ok: YA-${created.number} mine=${created.mine} voted=${created.voted} votes=${created.votes}")
        assertEquals(title, created.title)
        try {
            val v1 = client.vote(created.id)
            val v2 = client.vote(created.id)
            log("vote ok: toggle1 voted=${v1.voted} votes=${v1.votes}; toggle2 voted=${v2.voted} votes=${v2.votes}")
            assertTrue(v1.voted != v2.voted)

            val comment = client.comment(created.id, "[SDK test] comment, please ignore")
            log("comment ok: mine=${comment.mine} team=${comment.team}")
            assertTrue(comment.mine)

            val detail = client.get(created.id)
            log("get ok: comments=${detail.comments.size} canDelete=${detail.canDelete}")
            val mine = client.mine()
            log("mine ok: ${mine.size} request(s), contains created=${mine.any { it.id == created.id }}")
            assertTrue(mine.any { it.id == created.id })
        } finally {
            client.remove(created.id)
            log("delete ok")
        }
        try {
            client.get(created.id)
            // The server may soft-delete; report rather than fail.
            log("get after delete: still returns the request")
        } catch (e: YouAskedException) {
            log("get after delete: ${e.code}")
        }
        Unit
    }
}
