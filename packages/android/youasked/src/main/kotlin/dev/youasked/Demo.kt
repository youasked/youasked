package dev.youasked

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.random.Random

private const val MIN = 60_000L
private const val DAY = 24 * 60 * MIN

/**
 * A pretend backend for demo mode: sample requests in memory, a little fake latency, and a "team" that
 * answers a few seconds after you post or comment. Nothing leaves the device.
 */
internal class DemoClient(
    private val appName: String,
    private val scope: CoroutineScope,
    private val onNotice: (Notice) -> Unit,
) : Client {
    private class Stored(
        var req: FeatureRequest,
        val comments: MutableList<RequestComment> = mutableListOf(),
        var early: Boolean = false,
    )

    private val t0 = System.currentTimeMillis()
    private var seq = 100
    private val answered = mutableSetOf<String>()

    private fun seed(n: Int, title: String, body: String, votes: Int, status: Status, shipNote: String? = null, shippedAt: Long? = null,
                     creditName: String? = null, mine: Boolean = false, voted: Boolean = false, comments: List<RequestComment> = emptyList()) =
        Stored(
            FeatureRequest("demo_$n", n, title, body, status, votes, comments.size, shipNote, shippedAt, null, creditName,
                t0 - (20 - n) * DAY, voted, mine),
            comments.toMutableList(),
        )

    private fun team(id: String, body: String, ago: Long) = RequestComment(id, body, true, null, false, t0 - ago)

    private val store = mutableListOf(
        seed(12, "Split a bill with my partner", "We share groceries and rent. Would love to tag an expense as 50/50 and see who owes who.", 14, Status.Planned,
            comments = listOf(
                RequestComment("c1", "Yes! Even just splitting one expense would help.", false, "Raj", false, t0 - 3 * DAY),
                team("c2", "On the list for December. Would a simple “who owes who” total be enough to start?", 2 * DAY),
            )),
        seed(13, "Monthly budget per category", "Set \$400 for food and get a heads-up when I'm close.", 11, Status.InProgress),
        seed(7, "Dark mode for the charts", "", 8, Status.Shipped, "Charts now follow your theme. Settings → Appearance.", t0 - 2 * DAY, "Sam"),
        seed(14, "Import my bank statement PDF", "Some of my older expenses never came through email.", 6, Status.Open),
        seed(15, "Recurring expenses (Netflix, rent)", "", 4, Status.Open),
        seed(16, "Widget for the home screen", "Just today's total would be enough.", 3, Status.Open),
        seed(9, "Show which card I paid with", "", 5, Status.Shipped, "Each expense now shows the card's last 4 digits.", t0 - 4 * 60 * MIN, mine = true, voted = true),
        seed(17, "Export expenses to Excel", "For my accountant at tax time.", 2, Status.Open, mine = true, voted = true,
            comments = listOf(team("c3", "Good one. Would a CSV that opens in Excel work, or do you need .xlsx?", 3 * 60 * MIN))),
    )

    // One win the person asked for, outside the "what's new" list, so the demo shows the "it's live" card too.
    private val live = seed(11, "Pin my favourite categories", "", 9, Status.Shipped, "Long-press a category to pin it to the top.", t0 - 60 * MIN, mine = true, voted = true)
        .also { store.add(it) }

    private val config: Config by lazy {
        val shipped = store.filter { it.req.status == Status.Shipped && it.req.id != live.req.id }
        Config(
            appName = appName,
            watermark = false,
            identified = true,
            canCredit = true,
            unseen = listOf(Notice("demo_n1", "shipped", live.req.id, live.req.title, live.req.shipNote, null)),
            whatsNew = WhatsNew(
                total = shipped.size,
                items = shipped.sortedWith(compareByDescending<Stored> { it.req.mine }.thenByDescending { it.req.shippedAt ?: 0L })
                    .map { WhatsNewItem(it.req.id, it.req.title, it.req.shipNote, it.req.shippedAt ?: t0, it.req.mine) },
            ),
            nudge = null,
        )
    }

    private suspend fun wait(ms: Long = 380) = delay(ms + Random.nextLong(0, ms / 2 + 1))
    private fun find(id: String) = store.firstOrNull { it.req.id == id }
    private fun view(s: Stored) = s.req.copy(comments = s.comments.size)

    private val replies = listOf(
        "Thanks, this is useful. We've added it to the board. Roughly how often would you use it?",
        "Love this one. Can you tell us what you do today instead?",
        "Noted! The more votes it gets, the sooner it moves up.",
    )

    private fun scheduleReply(r: Stored, delayMs: Long) {
        if (!answered.add(r.req.id)) return
        scope.launch {
            delay(delayMs)
            val c = RequestComment("demo_c${++seq}", replies[seq % replies.size], true, null, false, System.currentTimeMillis())
            r.comments.add(c)
            onNotice(Notice("demo_n${++seq}", "reply", r.req.id, r.req.title, null, c.body))
        }
    }

    override suspend fun config(): Config { wait(200); return config }

    override suspend fun list(sort: String, status: String): List<FeatureRequest> {
        wait()
        val active = setOf(Status.Open, Status.Planned, Status.InProgress)
        val rows = store.filter {
            when (status) {
                "all" -> true
                "shipped" -> it.req.status == Status.Shipped
                else -> it.req.status in active
            }
        }
        val sorted = when {
            status == "shipped" -> rows.sortedByDescending { it.req.shippedAt ?: 0L }
            sort == "new" -> rows.sortedByDescending { it.req.createdAt }
            else -> rows.sortedWith(compareByDescending<Stored> { it.req.votes }.thenByDescending { it.req.createdAt })
        }
        return sorted.map(::view)
    }

    private fun words(s: String) = s.lowercase().split(Regex("[^a-z0-9]+")).filter { it.length > 2 }.toSet()

    override suspend fun similar(q: String): List<FeatureRequest> {
        wait(250)
        val w = words(q)
        if (w.isEmpty()) return emptyList()
        return store.filter { it.req.status != Status.Declined }
            .map { it to words(it.req.title) }
            .map { (s, tw) -> Triple(s, tw, tw.count { it in w }) }
            .filter { (_, tw, hits) -> hits >= 2 || (hits == 1 && tw.size <= 2) }
            .sortedByDescending { it.third }
            .take(3)
            .map { view(it.first) }
    }

    override suspend fun get(id: String): RequestDetail {
        wait()
        val r = find(id) ?: throw YouAskedException("not_found")
        val othersJoined = r.req.votes > (if (r.req.mine && r.req.voted) 1 else 0) || r.comments.any { !it.mine }
        return RequestDetail(view(r), r.comments.toList(), emptyList(), r.early, r.req.mine && r.req.status == Status.Open && !othersJoined, null)
    }

    override suspend fun remove(id: String) { wait(); store.removeAll { it.req.id == id } }

    override suspend fun create(input: NewRequest): Pair<FeatureRequest, List<Attachment>> {
        wait(650)
        val r = Stored(FeatureRequest("demo_${++seq}", 20 + store.size, input.title, if (input.body == input.title) "" else input.body, Status.Open, 1, 0,
            null, null, input.topic, null, System.currentTimeMillis(), voted = true, mine = true))
        store.add(0, r)
        scheduleReply(r, 5200)
        return view(r) to emptyList()
    }

    override suspend fun upload(image: ByteArray, mime: String): Attachment { wait(300); return Attachment("demo_up${++seq}", "") }

    override suspend fun vote(id: String): VoteResult {
        wait(180)
        val r = find(id) ?: throw YouAskedException("not_found")
        val voted = !r.req.voted
        r.req = r.req.copy(voted = voted, votes = r.req.votes + if (voted) 1 else -1)
        return VoteResult(voted, r.req.votes)
    }

    override suspend fun comment(id: String, body: String): RequestComment {
        wait(300)
        val r = find(id) ?: throw YouAskedException("not_found")
        val c = RequestComment("demo_c${++seq}", body, false, "You", true, System.currentTimeMillis())
        r.comments.add(c)
        if (r.req.mine) scheduleReply(r, 3800)
        return c
    }

    override suspend fun earlyAccess(id: String): Boolean { wait(200); val r = find(id)!!; r.early = !r.early; return r.early }
    override suspend fun mine(): List<FeatureRequest> { wait(); return store.filter { it.req.mine || it.req.voted }.map(::view) }
    override suspend fun seen(ids: List<String>) {}
    override suspend fun whatsNewSeen() {}
}
