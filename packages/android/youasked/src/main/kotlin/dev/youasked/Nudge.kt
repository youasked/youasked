package dev.youasked

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import org.json.JSONObject

/**
 * The occasional "Got an idea for <App>?" prompt. It waits until someone has used the app for a while,
 * skips their first visits, never shows twice within the chosen interval, steps back further each time it's
 * dismissed, and stays away from people who opened the sheet recently.
 */
public sealed class YouAskedNudge {
    /** Use the settings from the dashboard (the default). Nothing shows if the nudge is off there. */
    public data object Dashboard : YouAskedNudge()

    /** Never show it in this app. */
    public data object Off : YouAskedNudge()

    /** Turn it on from code. Anything left null falls back to the dashboard setting, then to the defaults. */
    public data class Custom(
        /** Show at most once every this many days. */
        val everyDays: Int? = null,
        /** Seconds someone must have the app in the foreground in this visit before it shows. */
        val activeSeconds: Int? = null,
        /** Visits to skip before the first prompt, so brand-new people get to look around. */
        val skipVisits: Int? = null,
        /** Headline. Defaults to "Got an idea for <App>?". */
        val message: String? = null,
        val position: NudgePosition? = null,
    ) : YouAskedNudge()
}

internal fun resolveNudge(server: NudgeSettings?, option: YouAskedNudge): NudgeSettings? = when (option) {
    YouAskedNudge.Off -> null
    YouAskedNudge.Dashboard -> server
    is YouAskedNudge.Custom -> {
        val base = server ?: NudgeSettings()
        NudgeSettings(
            everyDays = option.everyDays ?: base.everyDays,
            activeSeconds = option.activeSeconds ?: base.activeSeconds,
            skipVisits = option.skipVisits ?: base.skipVisits,
            message = option.message ?: base.message,
            position = option.position ?: base.position,
        )
    }
}

internal data class NudgeMemory(
    val visits: Int = 0,
    val lastVisitAt: Long = 0,
    val lastShownAt: Long = 0,
    val lastEngagedAt: Long = 0,
    val dismissals: Int = 0,
) {
    fun toJson(): String = JSONObject()
        .put("visits", visits).put("lastVisitAt", lastVisitAt).put("lastShownAt", lastShownAt)
        .put("lastEngagedAt", lastEngagedAt).put("dismissals", dismissals).toString()

    companion object {
        fun fromJson(s: String?): NudgeMemory = runCatching {
            val o = JSONObject(s ?: "{}")
            NudgeMemory(o.optInt("visits"), o.optLong("lastVisitAt"), o.optLong("lastShownAt"), o.optLong("lastEngagedAt"), o.optInt("dismissals"))
        }.getOrDefault(NudgeMemory())
    }
}

internal const val DAY_MS: Long = 24L * 60 * 60 * 1000

/** A new visit starts after this long away. */
internal const val VISIT_GAP_MS: Long = 30L * 60 * 1000

internal fun NudgeMemory.countVisit(now: Long): NudgeMemory =
    copy(visits = if (now - lastVisitAt > VISIT_GAP_MS) visits + 1 else visits, lastVisitAt = now)

/** Is this person due a prompt right now? */
internal fun isDue(m: NudgeMemory, s: NudgeSettings, now: Long): Boolean {
    val wait = s.everyDays * DAY_MS * (1L shl minOf(m.dismissals, 3))
    return m.visits > s.skipVisits && now - m.lastShownAt >= wait && now - m.lastEngagedAt >= wait
}

@Stable
internal class NudgeState(
    private val context: Context,
    /** Null means no memory (the demo): only the active time matters. */
    private val storageKey: String?,
) {
    var show by mutableStateOf(false)
        private set
    var memory: NudgeMemory? = null
        private set

    private val prefs get() = context.getSharedPreferences("youasked", Context.MODE_PRIVATE)

    private fun save() {
        val m = memory ?: return
        if (storageKey != null) prefs.edit().putString(storageKey, m.toJson()).apply()
    }

    /** Count this visit once settings are known. */
    fun startVisit(now: Long = System.currentTimeMillis()) {
        if (memory != null) return
        val loaded = if (storageKey != null) NudgeMemory.fromJson(prefs.getString(storageKey, null)) else NudgeMemory()
        memory = loaded.countVisit(now)
        save()
    }

    /** Called when the timer says they've been around long enough. */
    fun maybeShow(s: NudgeSettings, now: Long = System.currentTimeMillis()) {
        val m = memory ?: return
        if (storageKey != null && !isDue(m, s, now)) return
        memory = m.copy(lastShownAt = now)
        save()
        show = true
    }

    /** They opened the sheet, from the prompt or anywhere else: no prompt until the interval passes. */
    fun engaged() {
        memory = memory?.copy(lastEngagedAt = System.currentTimeMillis(), dismissals = 0)
        save()
        show = false
    }

    fun dismiss() {
        memory = memory?.let { it.copy(dismissals = it.dismissals + 1) }
        save()
        show = false
    }
}

/** Counts seconds with the app in front of the person, then asks [NudgeState] to show. [blocked] pauses it. */
@Composable
internal fun NudgeTimer(state: NudgeState, settings: NudgeSettings?, blocked: Boolean) {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(settings, blocked, state.show) {
        if (settings == null || state.show) return@LaunchedEffect
        state.startVisit()
        var active = 0
        var done = false
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (!done) {
                delay(1000)
                if (blocked) continue
                active += 1
                if (active >= settings.activeSeconds) {
                    done = true
                    state.maybeShow(settings)
                }
            }
        }
    }
}
