package dev.youasked

import android.content.Context
import android.content.SharedPreferences
import android.content.pm.ApplicationInfo
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.UUID

/** What to show when the sheet opens. */
public enum class OpenView {
    /** The chat-style start screen. */
    Home,

    /** The start screen with the composer focused. */
    New,
    Board,
    Shipped,
    Mine,
}

public data class OpenOptions(
    val view: OpenView = OpenView.Home,
    /** Jump straight to one request. */
    val requestId: String? = null,
    /** Pre-fills the composer, e.g. "Export to Excel" from a locked feature. */
    val draft: String? = null,
    /**
     * What the request is about, e.g. "charts". It's saved with the request, and the composer asks
     * "What would make charts better?". "search" and "locked" keep the default wording.
     */
    val topic: String? = null,
    /** Replaces the composer's placeholder. */
    val placeholder: String? = null,
)

internal sealed interface Route {
    data class Home(val draft: String? = null, val focus: Boolean = false, val topic: String? = null, val placeholder: String? = null) : Route
    data class Board(val tab: BoardTab = BoardTab.Top) : Route
    data class Detail(val id: String, val from: From? = null) : Route
    data object Mine : Route

    enum class From { Home, Board, Mine }
}

internal enum class BoardTab { Top, New, Shipped }

private val QuietTopics = setOf("search", "locked")

internal fun toRoute(o: OpenOptions): Route {
    if (o.requestId != null) return Route.Detail(o.requestId)
    val topic = o.topic?.trim()?.ifEmpty { null }
    val placeholder = o.placeholder ?: if (topic != null && o.draft.isNullOrEmpty() && topic !in QuietTopics) "What would make $topic better?" else null
    return when (o.view) {
        OpenView.New -> Route.Home(o.draft, true, topic, placeholder)
        OpenView.Board -> Route.Board()
        OpenView.Shipped -> Route.Board(BoardTab.Shipped)
        OpenView.Mine -> Route.Mine
        OpenView.Home -> Route.Home(o.draft, !o.draft.isNullOrEmpty() || topic != null, topic, placeholder)
    }
}

/** Holds everything the sheet, cards and entry points share. One per process. */
internal class Controller(
    val context: Context,
    val appKey: String,
    val apiUrl: String,
    val demo: Boolean,
) {
    private val prefs: SharedPreferences = context.getSharedPreferences("youasked", Context.MODE_PRIVATE)
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val debuggable = context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0

    var user: YouAskedUser? = null
        private set
    var signature: String? = null
        private set

    var client: Client by mutableStateOf(makeClient())
        private set

    var route: Route? by mutableStateOf(null)
    var config: Config? by mutableStateOf(null)
    var whatsNew: WhatsNew? by mutableStateOf(null)
    var whatsNewToast: Boolean by mutableStateOf(false)
    var disabled: Boolean by mutableStateOf(false)
    var closeTick: Int by mutableIntStateOf(0)
    var refreshTick: Int by mutableIntStateOf(0)
    var lastLoad: Long = 0

    val unseenCount: Int get() = config?.unseen?.size ?: 0

    val anonId: String
        get() = prefs.getString("anon", null) ?: UUID.randomUUID().toString().replace("-", "").also { prefs.edit().putString("anon", it).apply() }

    private fun makeClient(): Client =
        if (demo) DemoClient("this app", scope) { n -> config = config?.let { it.copy(unseen = it.unseen + n) } }
        else HttpClient(appKey, apiUrl, user, signature, { anonId }, debuggable)

    fun identify(user: YouAskedUser?, signature: String?) {
        this.user = user
        this.signature = signature
        if (!demo) {
            client = makeClient()
            config = null
        }
    }

    fun open(options: OpenOptions) {
        if (disabled) return
        route = toRoute(options)
    }

    fun requestClose() {
        closeTick++
    }

    fun markSeen(ids: List<String>) {
        if (ids.isEmpty()) return
        config = config?.let { c -> c.copy(unseen = c.unseen.filterNot { it.id in ids }) }
        scope.launch { runCatching { client.seen(ids) } }
    }

    private val whatsNewKey get() = "whats-new:$appKey:${user?.id ?: "anon"}"

    fun dismissWhatsNew() {
        whatsNew = null
        whatsNewToast = false
        if (!demo) prefs.edit().putLong(whatsNewKey, System.currentTimeMillis()).apply()
        scope.launch { runCatching { client.whatsNewSeen() } }
    }

    /** Fetches /config. Only what shipped after the last time they were shown the list counts as new. */
    suspend fun loadConfig() {
        try {
            lastLoad = System.currentTimeMillis()
            val c = client.config()
            val seenAt = if (demo) 0L else prefs.getLong(whatsNewKey, 0L)
            val items = c.whatsNew?.items?.filter { it.shippedAt > seenAt }.orEmpty()
            val news = if (c.whatsNew != null && items.isNotEmpty()) c.whatsNew.copy(items = items) else null
            disabled = false
            config = c
            whatsNew = news
            // A toast on first load, unless a notice that isn't already part of the list is waiting.
            whatsNewToast = news != null && c.unseen.none { !coveredBy(news, it) }
        } catch (e: YouAskedException) {
            if (e.code == "test_mode") {
                disabled = true
                if (!warnedTestMode) {
                    warnedTestMode = true
                    Log.w("YouAsked", "This app is in test mode, so feature requests are hidden in this build. Subscribe at https://app.youasked.dev to turn them on.")
                }
            }
        }
    }

    companion object {
        private var warnedTestMode = false

        fun coveredBy(news: WhatsNew?, n: Notice): Boolean =
            n.kind == "shipped" && news?.items?.any { it.id == n.requestId } == true
    }
}

/** The public entry point: configure once, optionally identify, then open the sheet from anywhere. */
public object YouAsked {
    @Volatile
    internal var controller: Controller? = null

    /**
     * Call once, for example in `Application.onCreate`. The app key (`ya_pub_...`) is safe to ship in the app.
     *
     * @param demo run on sample data with a pretend team: no key, no network.
     */
    @JvmStatic
    @JvmOverloads
    public fun configure(context: Context, appKey: String, apiUrl: String = DEFAULT_API_URL, demo: Boolean = false) {
        controller = Controller(context.applicationContext, appKey, apiUrl, demo)
    }

    /** Sample data and a pretend team, no key or network. Handy for previews and trying it out. */
    @JvmStatic
    public fun configureDemo(context: Context) {
        configure(context, appKey = "", demo = true)
    }

    /**
     * Who's asking. Pass the signature your server made for this user id (see the README); without it the
     * server treats the person as anonymous. Call with null when they sign out.
     */
    @JvmStatic
    @JvmOverloads
    public fun identify(user: YouAskedUser?, signature: String? = null) {
        controller?.identify(user, signature) ?: Log.w("YouAsked", "identify() called before configure()")
    }

    /** Opens the sheet on the start screen. */
    @JvmStatic
    public fun open() {
        open(OpenOptions())
    }

    /** Opens the composer already about a topic, e.g. `open("charts")`. The topic is saved with the request. */
    @JvmStatic
    public fun open(topic: String) {
        open(OpenOptions(view = OpenView.New, topic = topic))
    }

    @JvmStatic
    public fun open(options: OpenOptions) {
        controller?.open(options) ?: Log.w("YouAsked", "open() called before configure()")
    }

    @JvmStatic
    public fun close() {
        controller?.requestClose()
    }

    /** Replies and "it's live" notices this person hasn't seen yet. Read it in composition and it updates. */
    public val unseenCount: Int get() = controller?.unseenCount ?: 0
}
