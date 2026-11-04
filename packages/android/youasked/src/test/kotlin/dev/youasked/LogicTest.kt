package dev.youasked

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LogicTest {
    private val T0 = 1_700_000_000_000L
    private val s = NudgeSettings(everyDays = 7, activeSeconds = 30, skipVisits = 1)

    @Test
    fun nudgeSkipsFirstVisits() {
        val m = NudgeMemory().countVisit(T0)
        assertEquals(1, m.visits)
        assertFalse(isDue(m, s, 10 * DAY_MS))
        assertTrue(isDue(m.copy(visits = 2), s, 10 * DAY_MS))
    }

    @Test
    fun visitsOnlyCountAfterAGap() {
        val a = NudgeMemory().countVisit(T0)
        assertEquals(1, a.countVisit(T0 + 60_000).visits)
        assertEquals(2, a.countVisit(T0 + VISIT_GAP_MS + 1).visits)
    }

    @Test
    fun nudgeNeverShowsTwiceWithinTheInterval() {
        val now = 100 * DAY_MS
        val m = NudgeMemory(visits = 5, lastShownAt = now - 3 * DAY_MS)
        assertFalse(isDue(m, s, now))
        assertTrue(isDue(m, s, now + 5 * DAY_MS))
    }

    @Test
    fun nudgeBacksOffAfterEachDismissalUpToEightTimes() {
        val now = 1000 * DAY_MS
        fun due(dismissals: Int, since: Long) = isDue(NudgeMemory(visits = 5, lastShownAt = now - since * DAY_MS, dismissals = dismissals), s, now)
        assertTrue(due(0, 7)); assertFalse(due(1, 13)); assertTrue(due(1, 14))
        assertFalse(due(2, 27)); assertTrue(due(2, 28))
        assertFalse(due(3, 55)); assertTrue(due(3, 56))
        assertFalse(due(9, 55)); assertTrue(due(9, 56))
    }

    @Test
    fun nudgeStaysAwayFromPeopleWhoRecentlyOpenedTheSheet() {
        val now = 100 * DAY_MS
        assertFalse(isDue(NudgeMemory(visits = 5, lastEngagedAt = now - DAY_MS), s, now))
        assertTrue(isDue(NudgeMemory(visits = 5, lastEngagedAt = now - 8 * DAY_MS), s, now))
    }

    @Test
    fun nudgeMemoryRoundTripsAndSurvivesGarbage() {
        val m = NudgeMemory(3, 1, 2, 3, 4)
        assertEquals(m, NudgeMemory.fromJson(m.toJson()))
        assertEquals(NudgeMemory(), NudgeMemory.fromJson("not json"))
        assertEquals(NudgeMemory(), NudgeMemory.fromJson(null))
    }

    @Test
    fun resolveNudgeHonoursOffDashboardAndOverrides() {
        val server = NudgeSettings(everyDays = 14, activeSeconds = 60, skipVisits = 2, message = "Hi")
        assertNull(resolveNudge(server, YouAskedNudge.Off))
        assertNull(resolveNudge(null, YouAskedNudge.Dashboard))
        assertEquals(server, resolveNudge(server, YouAskedNudge.Dashboard))
        assertEquals(server.copy(activeSeconds = 5), resolveNudge(server, YouAskedNudge.Custom(activeSeconds = 5)))
        assertEquals(NudgeSettings(), resolveNudge(null, YouAskedNudge.Custom()))
    }

    @Test
    fun longMessagesKeepTheirFirstSentenceAsTitle() {
        assertEquals("Dark mode" to "", splitMessage("  Dark mode "))
        val (title, body) = splitMessage("Please add dark mode to the charts. It hurts my eyes at night, and the white background is far too bright when I check my spending in bed.")
        assertEquals("Please add dark mode to the charts.", title)
        assertTrue(body.startsWith("Please add dark mode"))
        val long = "a".repeat(200)
        assertEquals(120, splitMessage(long).first.length)
    }

    @Test
    fun routesFromOpenOptions() {
        assertEquals(Route.Detail("r1"), toRoute(OpenOptions(requestId = "r1")))
        assertEquals(Route.Home(null, true, "charts", "What would make charts better?"), toRoute(OpenOptions(view = OpenView.New, topic = "charts")))
        assertEquals(Route.Home("Export", true, "search", null), toRoute(OpenOptions(view = OpenView.New, draft = "Export", topic = "search")))
        assertEquals(Route.Board(BoardTab.Shipped), toRoute(OpenOptions(view = OpenView.Shipped)))
        assertEquals(Route.Home(), toRoute(OpenOptions()))
    }

    @Test
    fun agoReadsLikeTheOtherSdks() {
        val now = 10_000_000_000L
        assertEquals("just now", ago(now - 20_000, now))
        assertEquals("5m ago", ago(now - 5 * 60_000L, now))
        assertEquals("3h ago", ago(now - 3 * 3_600_000L, now))
        assertEquals("2d ago", ago(now - 2 * 86_400_000L, now))
    }

    @Test
    fun themePicksReadableTextOnTheAccent() {
        val light = resolveTheme(YouAskedAppearance(), systemDark = false)
        assertFalse(light.dark)
        val dark = resolveTheme(YouAskedAppearance(mode = YouAskedMode.Dark), systemDark = false)
        assertTrue(dark.dark)
        assertEquals(androidx.compose.ui.graphics.Color.White, light.accentFg)
        val pale = resolveTheme(YouAskedAppearance(accent = androidx.compose.ui.graphics.Color(0xFFFFE066)), systemDark = false)
        assertTrue(pale.accentFg != androidx.compose.ui.graphics.Color.White)
        assertEquals(999f, resolveTheme(YouAskedAppearance(buttonRadius = ButtonRadius.Pill), false).buttonRadius!!.value)
    }
}
