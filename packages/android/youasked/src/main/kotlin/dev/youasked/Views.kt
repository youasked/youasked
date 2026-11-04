package dev.youasked

import android.graphics.BitmapFactory
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.InfiniteRepeatableSpec
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.StartOffset
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/** Renders the current screen. Shared by the sheet and the embedded board. */
@Composable
internal fun Navigator(route: Route, setRoute: (Route) -> Unit, onClose: (() -> Unit)?) {
    val key: Any = when (route) {
        is Route.Home -> "home${route.draft.orEmpty()}${route.focus}${route.topic.orEmpty()}"
        is Route.Board -> "board"
        is Route.Detail -> "d${route.id}"
        Route.Mine -> "mine"
    }
    AnimatedContent(
        targetState = route,
        contentKey = { r ->
            when (r) {
                is Route.Home -> "home${r.draft.orEmpty()}${r.focus}${r.topic.orEmpty()}"
                is Route.Board -> "board"
                is Route.Detail -> "d${r.id}"
                Route.Mine -> "mine"
            }
        },
        transitionSpec = {
            (fadeIn(tween(200, easing = FastOutSlowInEasing)) + slideInVertically(tween(200)) { it / 60 }) togetherWith fadeOut(tween(90))
        },
        label = "youasked-route",
        modifier = Modifier.fillMaxSize(),
    ) { r ->
        when (r) {
            is Route.Home -> Home(r, setRoute, onClose)
            is Route.Board -> Board(r.tab, setRoute, onClose)
            is Route.Detail -> Detail(r.id, r.from, setRoute, onClose)
            Route.Mine -> Mine(setRoute, onClose)
        }
    }
    @Suppress("UNUSED_EXPRESSION") key
}

// ---------------------------------------------------------------- shared composer

@Composable
internal fun Composer(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    label: String,
    maxLength: Int,
    canSend: Boolean,
    sendLabel: String,
    onSend: () -> Unit,
    modifier: Modifier = Modifier,
    focusRequester: FocusRequester? = null,
) {
    val t = ui().theme
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(t.buttonRadius ?: 24.dp)
    Row(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(t.surface)
            .border(1.5.dp, if (focused) mix(t.accent, t.surface, 0.55f) else Color.Transparent, shape)
            .padding(start = 16.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        BasicTextField(
            value = value,
            onValueChange = { if (it.length <= maxLength) onValueChange(it) },
            modifier = Modifier
                .weight(1f)
                .heightIn(min = 40.dp, max = 132.dp)
                .padding(vertical = 9.dp)
                .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
                .onFocusChanged { focused = it.isFocused }
                .semantics { contentDescription = label },
            textStyle = TextStyle(color = t.fg, fontSize = 16.sp, lineHeight = 22.sp, fontFamily = t.fontFamily),
            cursorBrush = SolidColor(t.accent),
            maxLines = 6,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            decorationBox = { inner ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty()) T(placeholder, size = 16f, color = t.muted, lineHeight = 22f, maxLines = 1)
                    inner()
                }
            },
        )
        Box(
            Modifier
                .padding(bottom = 0.dp)
                .size(36.dp)
                .alpha(if (canSend) 1f else 0.3f)
                .clip(CircleShape)
                .background(t.accent)
                .tap(onSend, enabled = canSend, label = sendLabel),
            contentAlignment = Alignment.Center,
        ) { IconSend(t.accentFg) }
    }
}


// ---------------------------------------------------------------- home: a chat-style start screen

private sealed interface ThreadItem {
    data class Out(val text: String, val images: List<ByteArray>) : ThreadItem
    data object Typing : ThreadItem
    data class Posted(val request: FeatureRequest) : ThreadItem
    data class Reply(val notice: Notice) : ThreadItem
    data class Error(val text: String) : ThreadItem
}

/** Long messages keep their first line or sentence as the title and the full text as details. */
internal fun splitMessage(text: String): Pair<String, String> {
    val t = text.trim()
    if (t.length <= 120 && !t.contains('\n')) return t to ""
    val first = t.split("\n")[0]
    val sentence = Regex("^(.{12,120}?[.!?])\\s").find(first)?.groupValues?.get(1)
    val title = (sentence ?: first).take(120).trim()
    return title to t
}

@Composable
private fun ReplyBubble(notice: Notice, appName: String, onOpen: () -> Unit) {
    val t = ui().theme
    Bubble {
        T("$appName replied about ${notice.title}", size = 12.5f, weight = SemiBold, color = t.muted)
        T(notice.reply.orEmpty(), lineHeight = 21f)
        Box(Modifier.tap(onOpen).padding(vertical = 2.dp)) { T("Reply", size = 14f, weight = Bold, color = t.accent) }
    }
}

/** A short burst from the corner of a bubble when something they asked for has shipped. */
@Composable
private fun Confetti(modifier: Modifier) {
    val t = ui().theme
    val p = remember { Animatable(0f) }
    LaunchedEffect(Unit) { p.animateTo(1f, tween(950, easing = androidx.compose.animation.core.CubicBezierEasing(0.215f, 0.61f, 0.355f, 1f))) }
    val colors = listOf(t.accent, t.green, t.amber, Color(0xFFFF7EB3))
    Canvas(modifier.size(1.dp)) {
        val v = p.value
        val alpha = when {
            v < 0.1f -> v / 0.1f
            v < 0.7f -> 1f
            else -> ((1f - v) / 0.3f).coerceIn(0f, 1f)
        }
        for (i in 0 until 14) {
            val angle = (PI * (0.15 + (i / 13.0) * 0.7)) % PI
            val dist = 38 + (i % 4) * 14
            val x = (cos(angle) * dist * (if (i % 2 == 1) -1 else 1)).toFloat()
            val y = (-sin(angle) * dist).toFloat()
            val dx = x * v * density
            val dy = (y + 24) * v * density
            rotate(((i * 67) % 360) * v, Offset(dx, dy)) {
                drawRoundRect(colors[i % colors.size].copy(alpha = alpha), Offset(dx - 3 * density, dy - 3 * density), Size(6 * density, 9 * density),
                    androidx.compose.ui.geometry.CornerRadius(2 * density))
            }
        }
    }
}

@Composable
private fun Typing() {
    val t = ui().theme
    Bubble {
        val tr = rememberInfiniteTransition(label = "typing")
        Row(Modifier.padding(vertical = 4.dp, horizontal = 2.dp).semantics { contentDescription = "Typing" }, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            repeat(3) { i ->
                val a by tr.animateFloat(
                    0.3f, 1f,
                    InfiniteRepeatableSpec(tween(350), RepeatMode.Reverse, initialStartOffset = StartOffset(i * 150)),
                    label = "dot$i",
                )
                Box(Modifier.size(7.dp).alpha(a).clip(CircleShape).background(t.muted))
            }
        }
    }
}

private const val MAX_SHOTS = 3

@Composable
private fun Shot(bytes: ByteArray, label: String, onRemove: () -> Unit) {
    val t = ui().theme
    val bmp = remember(bytes) { runCatching { BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap() }.getOrNull() }
    Row(
        Modifier.clip(RoundedCornerShape(14.dp)).background(t.surface).padding(4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (bmp != null) Image(bmp, null, Modifier.size(40.dp).clip(RoundedCornerShape(10.dp)), contentScale = ContentScale.Crop)
        T(label, size = 13f, weight = SemiBold)
        CircleIconButton("Remove screenshot", onRemove, plain = true, size = 24.dp) { IconClose(t.muted, 13.dp) }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Home(route: Route.Home, setRoute: (Route) -> Unit, onClose: (() -> Unit)?) {
    val ui = ui()
    val t = ui.theme
    val ctl = ui.ctl
    val client = ui.client
    val config = ctl.config
    val appName = ui.appName
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()

    val top = rememberLoad(client) { client.list("top", "active") }
    val shipped = rememberLoad(client) { client.list("new", "shipped") }
    var text by rememberSaveable { mutableStateOf(route.draft.orEmpty()) }
    val thread = remember { mutableStateListOf<ThreadItem>() }
    var similar by remember { mutableStateOf<List<FeatureRequest>>(emptyList()) }
    val notices = remember { config?.unseen.orEmpty() }
    // What shipped since the last visit is shown once: read it now, then tell the server it's been seen.
    val news = remember { ctl.whatsNew }
    val shots = remember { mutableStateListOf<ByteArray>() }
    var shotError by remember { mutableStateOf<String?>(null) }
    var credit by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    val scroll = rememberScrollState()
    val sending = thread.any { it is ThreadItem.Typing }

    LaunchedEffect(Unit) { if (notices.isNotEmpty()) ctl.markSeen(notices.map { it.id }) }
    LaunchedEffect(Unit) {
        if (news != null) ctl.dismissWhatsNew()
        if (news?.items?.any { it.mine } == true) haptic.performHapticFeedback(HapticFeedbackType.Confirm)
    }

    // The team answering while this screen is open (the demo does this a few seconds after you post).
    val arrived = config?.unseen.orEmpty().filter { n -> n.kind == "reply" && notices.none { it.id == n.id } }
    val arrivedKey = arrived.joinToString(",") { it.id }
    LaunchedEffect(arrivedKey) {
        if (arrived.isEmpty()) return@LaunchedEffect
        arrived.forEach { thread.add(ThreadItem.Reply(it)) }
        ctl.markSeen(arrived.map { it.id })
        haptic.performHapticFeedback(HapticFeedbackType.Confirm)
    }

    LaunchedEffect(route.focus) {
        if (!route.focus) return@LaunchedEffect
        // Wait for the sheet to finish sliding up, or the keyboard fights the animation.
        delay(380)
        runCatching { focus.requestFocus() }
        keyboard?.show()
    }

    LaunchedEffect(thread.size) {
        if (thread.isNotEmpty()) { delay(60); scroll.animateScrollTo(scroll.maxValue) }
    }

    LaunchedEffect(client, text) {
        val q = text.trim()
        if (q.length < 4) { similar = emptyList(); return@LaunchedEffect }
        delay(350)
        similar = runCatching { client.similar(q).take(3) }.getOrDefault(emptyList())
    }

    val openRequest = { id: String -> setRoute(Route.Detail(id, Route.From.Home)) }
    val asking = if (route.topic != null && route.placeholder != null) route.topic else null
    val placeholder = route.placeholder ?: "Ask for a feature…"
    val yours = news?.items?.firstOrNull { it.mine }
    val listed = news?.items?.map { it.id }?.toSet().orEmpty()
    val shownNotices = notices.filterNot { it.kind == "shipped" && it.requestId in listed }
    val canSend = text.trim().length >= 3 && !sending
    val chatting = thread.isNotEmpty()

    fun send() {
        val message = text.trim()
        if (message.length < 3 || sending) return
        val attached = shots.toList()
        val credited = credit && config?.canCredit == true
        text = ""; similar = emptyList(); shots.clear(); shotError = null; credit = false
        haptic.performHapticFeedback(HapticFeedbackType.ContextClick)
        thread.add(ThreadItem.Out(message, attached))
        thread.add(ThreadItem.Typing)
        val (title, body) = splitMessage(message)
        scope.launch {
            try {
                val ids = attached.map { client.upload(it).id }
                val started = System.currentTimeMillis()
                val (request, _) = client.create(NewRequest(title, body, ids, route.topic, credited))
                // Let the typing dots show for a beat so the reply doesn't feel instant.
                val left = 650 - (System.currentTimeMillis() - started)
                if (left > 0) delay(left)
                thread.removeAll { it is ThreadItem.Typing }
                thread.add(ThreadItem.Posted(request))
                haptic.performHapticFeedback(HapticFeedbackType.Confirm)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                thread.removeAll { it is ThreadItem.Typing || (it is ThreadItem.Out && it.text == message) }
                val ye = e as? YouAskedException
                thread.add(ThreadItem.Error(errorText(ye?.code ?: "network", ye?.detail)))
                text = message
                shots.addAll(attached)
                credit = credited
            }
        }
    }

    Column(Modifier.fillMaxSize()) {
        Header(
            title = appName,
            subtitle = "Ideas, votes and what's new",
            leading = { AppAvatar(ui.appIcon) },
            onClose = onClose,
        )
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(scroll).padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Bubble {
                T(
                    if (asking != null) "Let's talk about $asking. What's missing, or what bugs you?"
                    else ui.greeting ?: "Hey! What would make $appName better for you?",
                    lineHeight = 21f,
                )
            }
            if (news != null) {
                Box {
                    Bubble(tone = if (yours != null) Tone.Win else Tone.In, stretch = true) {
                        T(whatsNewHeading(news.total), size = 12.5f, weight = SemiBold, color = t.muted)
                        Column(Modifier.fillMaxWidth()) {
                            news.items.forEachIndexed { idx, i ->
                                Row(
                                    Modifier.fillMaxWidth().tap({ openRequest(i.id) }, scale = false).padding(vertical = 8.dp)
                                        .then(if (idx > 0) Modifier.topHairline(mix(t.fg, t.surface, 0.18f)) else Modifier),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                ) {
                                    GreenDot()
                                    Column(Modifier.weight(1f)) {
                                        T(i.title, size = 14.5f, weight = SemiBold, lineHeight = 19f)
                                        if (i.mine) T("You asked for this", size = 12f, weight = Bold, color = t.green)
                                    }
                                    IconChevron(t.muted, 16.dp)
                                }
                            }
                        }
                        if (yours != null) T("That one was yours. Thanks for asking.", lineHeight = 21f)
                        if (news.total > news.items.size) {
                            Box(Modifier.tap({ setRoute(Route.Board(BoardTab.Shipped)) })) { T("See all ${news.total}", size = 14f, weight = Bold, color = t.accent) }
                        }
                    }
                    if (yours != null) Confetti(Modifier.align(Alignment.TopEnd).padding(top = 14.dp, end = 18.dp))
                }
            }
            shownNotices.forEach { n ->
                if (n.kind == "reply") ReplyBubble(n, appName) { openRequest(n.requestId) }
                else Bubble(tone = Tone.Win) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        GreenDot(18.dp)
                        T("It's live", size = 14f, weight = Bold, color = t.green)
                    }
                    T(rich("You asked for " to false, n.title to true, ". ${n.shipNote ?: "Thanks for asking."}" to false), lineHeight = 21f)
                    Box(Modifier.tap({ openRequest(n.requestId) })) { T("See it", size = 14f, weight = Bold, color = t.accent) }
                }
            }

            if (!chatting) {
                Section("Popular right now", "See all", { setRoute(Route.Board()) }) {
                    val d = top.data
                    when {
                        top.error != null -> T(errorText(top.error), size = 13.5f, color = t.muted, lineHeight = 19f, modifier = Modifier.padding(top = 10.dp))
                        d == null -> Skeleton(2)
                        d.isEmpty() -> T("No requests yet. Yours could be the first.", size = 13.5f, color = t.muted, lineHeight = 19f, modifier = Modifier.padding(top = 10.dp))
                        else -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            d.take(3).forEach { r -> RequestRow(client, r, { openRequest(r.id) }, compact = true) }
                        }
                    }
                }
                val s = shipped.data
                if (s != null && s.isNotEmpty()) {
                    Section("Recently shipped", "All", { setRoute(Route.Board(BoardTab.Shipped)) }) {
                        Column {
                            s.take(3).forEachIndexed { i, r ->
                                Row(
                                    Modifier.fillMaxWidth().tap({ openRequest(r.id) }, scale = false).padding(vertical = 9.dp, horizontal = 2.dp)
                                        .then(if (i < minOf(s.size, 3) - 1) Modifier.bottomHairline(t.border) else Modifier),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                ) {
                                    GreenDot()
                                    T(r.title, size = 14.5f, weight = FontWeightMedium, maxLines = 1, modifier = Modifier.weight(1f))
                                    T(r.shippedAt?.let { ago(it) }.orEmpty(), size = 12.5f, color = t.muted)
                                }
                            }
                        }
                    }
                }
            }

            thread.forEach { item ->
                when (item) {
                    is ThreadItem.Out -> Bubble(tone = Tone.Out) {
                        item.images.forEach { b ->
                            val bmp = remember(b) { runCatching { BitmapFactory.decodeByteArray(b, 0, b.size)?.asImageBitmap() }.getOrNull() }
                            if (bmp != null) Image(bmp, "Your screenshot", Modifier.size(200.dp, 120.dp).clip(RoundedCornerShape(12.dp)), contentScale = ContentScale.Crop)
                        }
                        T(item.text, color = t.accentFg, lineHeight = 21f)
                    }
                    ThreadItem.Typing -> Typing()
                    is ThreadItem.Reply -> ReplyBubble(item.notice, appName) { openRequest(item.notice.requestId) }
                    is ThreadItem.Posted -> Bubble {
                        T(rich("Got it. " to false, item.request.title to true, " is on the board, and we'll tell you right here when it ships." to false), lineHeight = 21f)
                        Box(Modifier.tap({ openRequest(item.request.id) }).padding(vertical = 2.dp)) { T("View request", size = 14f, weight = Bold, color = t.accent) }
                    }
                    is ThreadItem.Error -> Bubble(tone = Tone.Error) {
                        T(item.text, lineHeight = 21f, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive })
                    }
                }
            }
            if (chatting && !sending) {
                Box(
                    Modifier.align(Alignment.CenterHorizontally).padding(top = 6.dp)
                        .clip(RoundedCornerShape(t.buttonRadius ?: 999.dp)).background(t.tint)
                        .tap({ setRoute(Route.Board()) }).padding(horizontal = 14.dp, vertical = 8.dp),
                ) { T("See what others asked for", size = 13.5f, weight = SemiBold, color = t.accent) }
            }
        }

        Column(
            Modifier.fillMaxWidth().background(t.bg).topHairline(t.border).padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 10.dp),
        ) {
            if (similar.isNotEmpty()) {
                Column(
                    Modifier.fillMaxWidth().padding(bottom = 8.dp).clip(RoundedCornerShape(t.radius + 2.dp)).background(t.tint).padding(10.dp),
                ) {
                    T("Sounds like one of these. Vote instead?", size = 13f, weight = Bold, modifier = Modifier.padding(start = 2.dp, bottom = 8.dp, end = 2.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        similar.forEach { r -> RequestRow(client, r, { openRequest(r.id) }, compact = true, onTint = true) }
                    }
                }
            }
            if (shots.isNotEmpty()) {
                FlowRow(Modifier.padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    shots.forEachIndexed { i, b ->
                        Shot(b, "Screenshot${if (shots.size > 1) " ${i + 1}" else ""}") { shots.remove(b) }
                    }
                }
            }
            Composer(
                value = text,
                onValueChange = { text = it },
                placeholder = placeholder,
                label = if (asking != null) placeholder else "Ask for a feature",
                maxLength = 2000,
                canSend = canSend,
                sendLabel = "Send",
                onSend = ::send,
                focusRequester = focus,
            )
            val showCredit = config?.canCredit == true && text.trim().isNotEmpty()
            if (ui.capture != null || showCredit) {
                Row(
                    Modifier.fillMaxWidth().padding(top = 8.dp).heightIn(min = 32.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    if (ui.capture != null) {
                        Row(
                            Modifier.height(32.dp).clip(RoundedCornerShape(t.buttonRadius ?: 999.dp)).background(t.tint)
                                .tap({
                                    scope.launch {
                                        shotError = null
                                        try {
                                            ui.capture.invoke()?.let { shots.add(it) }
                                        } catch (e: CancellationException) { throw e } catch (e: Exception) {
                                            shotError = "Couldn't capture the screen. You can still describe it in words."
                                        }
                                    }
                                }, enabled = !sending && shots.size < MAX_SHOTS)
                                .padding(start = 10.dp, end = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            IconFrame(t.accent, 16.dp)
                            T("Show us", size = 13.5f, weight = SemiBold, color = t.accent)
                        }
                    } else Box {}
                    if (showCredit) {
                        Row(
                            Modifier.tap({ credit = !credit }, scale = false, role = Role.Switch)
                                .semantics { stateDescription = if (credit) "On" else "Off" }
                                .padding(vertical = 4.dp, horizontal = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            T("Credit me when it ships", size = 13f, weight = SemiBold, color = if (credit) t.fg else t.muted)
                            Toggle(credit)
                        }
                    }
                }
            }
            if (shotError != null) {
                T(shotError!!, size = 13.5f, color = t.muted, lineHeight = 19f, modifier = Modifier.padding(top = 10.dp).semantics { liveRegion = LiveRegionMode.Assertive })
            }
            if (config?.watermark == true) T("Feedback by YouAsked", size = 11.5f, color = t.muted, align = androidx.compose.ui.text.style.TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
        }
    }
}

internal val FontWeightMedium = androidx.compose.ui.text.font.FontWeight.Medium

internal fun Modifier.topHairline(c: Color): Modifier = this.then(Modifier.drawBehindLine(c, top = true))
internal fun Modifier.bottomHairline(c: Color): Modifier = this.then(Modifier.drawBehindLine(c, top = false))

private fun Modifier.drawBehindLine(c: Color, top: Boolean): Modifier = this.then(
    Modifier.drawWithContent2 {
        drawContent()
        val w = 1f.coerceAtLeast(0.5f * density)
        val y = if (top) w / 2 else size.height - w / 2
        drawLine(c, Offset(0f, y), Offset(size.width, y), w)
    },
)

private fun Modifier.drawWithContent2(block: androidx.compose.ui.graphics.drawscope.ContentDrawScope.() -> Unit): Modifier =
    this.drawWithContent(block)

// ---------------------------------------------------------------- full board

private data class TabDef(val key: BoardTab, val label: String, val sort: String, val status: String)

private val Tabs = listOf(
    TabDef(BoardTab.Top, "Top", "top", "active"),
    TabDef(BoardTab.New, "New", "new", "active"),
    TabDef(BoardTab.Shipped, "Shipped", "new", "shipped"),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Board(initialTab: BoardTab, setRoute: (Route) -> Unit, onClose: (() -> Unit)?) {
    val ui = ui()
    val t = ui.theme
    val client = ui.client
    var tab by rememberSaveable { mutableStateOf(initialTab) }
    val def = Tabs.first { it.key == tab }
    val load = rememberLoad(client to tab) { client.list(def.sort, def.status) }
    Column(Modifier.fillMaxSize()) {
        Header(ui.title, onBack = { setRoute(Route.Home()) }, onClose = onClose, right = { LinkButton("Yours", { setRoute(Route.Mine) }) })
        Row(
            Modifier.padding(horizontal = 16.dp).padding(bottom = 8.dp).fillMaxWidth()
                .clip(RoundedCornerShape(t.radius - 2.dp)).background(t.surface).padding(3.dp)
                .semantics { role = Role.Tab },
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Tabs.forEach { d ->
                val on = d.key == tab
                val shape = RoundedCornerShape(maxOf(t.radius.value - 5f, 6f).dp)
                Box(
                    Modifier.weight(1f)
                        .then(if (on) Modifier.androidxShadow(1.dp, shape) else Modifier)
                        .clip(shape).background(if (on) t.bg else Color.Transparent)
                        .tap({ tab = d.key }, scale = false, role = Role.Tab)
                        .semantics { stateDescription = if (on) "Selected" else "Not selected" }
                        .padding(vertical = 7.dp),
                    contentAlignment = Alignment.Center,
                ) { T(d.label, size = 14f, weight = SemiBold, color = if (on) t.fg else t.muted) }
            }
        }
        RequestList(
            load = load,
            emptyTitle = if (tab == BoardTab.Shipped) "Nothing shipped yet" else "No requests yet",
            emptyText = if (tab == BoardTab.Shipped) "Requests show up here once they're live." else "Tell us what you'd like next. Others can vote on it.",
            errorTitle = "Couldn't load requests",
            from = Route.From.Board,
            setRoute = setRoute,
            modifier = Modifier.weight(1f),
        )
        Foot { Button("Request a feature", { setRoute(Route.Home(focus = true)) }, Modifier.fillMaxWidth(), icon = { IconPlus(t.accentFg) }) }
    }
}

private fun Modifier.androidxShadow(elevation: androidx.compose.ui.unit.Dp, shape: androidx.compose.ui.graphics.Shape) =
    this.shadow(elevation, shape)

@Composable
private fun Foot(content: @Composable () -> Unit) {
    val t = ui().theme
    Box(Modifier.fillMaxWidth().background(t.bg).topHairline(t.border).padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 12.dp)) { content() }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RequestList(
    load: Load<List<FeatureRequest>>,
    emptyTitle: String,
    emptyText: String,
    errorTitle: String,
    from: Route.From,
    setRoute: (Route) -> Unit,
    modifier: Modifier,
) {
    val client = ui().client
    val data = load.data
    Box(modifier.fillMaxWidth()) {
        when {
            load.error != null -> Empty(errorTitle, errorText(load.error))
            data == null -> Box(Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) { Skeleton() }
            else -> PullToRefreshBox(isRefreshing = load.refreshing, onRefresh = load.refresh) {
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 18.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (data.isEmpty()) item { Empty(emptyTitle, emptyText) }
                    items(data, key = { it.id }) { r -> RequestRow(client, r, { setRoute(Route.Detail(r.id, from)) }) }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- one request

@Composable
private fun Detail(id: String, from: Route.From?, setRoute: (Route) -> Unit, onClose: (() -> Unit)?) {
    val ui = ui()
    val t = ui.theme
    val ctl = ui.ctl
    val client = ui.client
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val load = rememberLoad(client to id) { client.get(id) }
    val data = load.data

    // Opening a request someone was told about counts as seeing it.
    val unseenHere = ctl.config?.unseen.orEmpty().filter { it.requestId == id }.joinToString(",") { it.id }
    LaunchedEffect(unseenHere) {
        if (unseenHere.isEmpty()) return@LaunchedEffect
        ctl.markSeen(unseenHere.split(","))
        // A reply that lands while you're reading shows up in the thread.
        if (load.data != null) runCatching { client.get(id) }.onSuccess { load.setData(it) }
    }

    var reply by rememberSaveable { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var replyError by remember { mutableStateOf<String?>(null) }
    var voted by remember { mutableStateOf<Boolean?>(null) }
    var early by remember(data?.earlyAccess) { mutableStateOf(data?.earlyAccess ?: false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    var deleteError by remember { mutableStateOf<String?>(null) }
    val scroll = rememberScrollState()

    LaunchedEffect(data?.redirect) { data?.redirect?.let { setRoute(Route.Detail(it)) } }

    val request = data?.request
    val comments = data?.comments.orEmpty()

    fun remove() {
        if (request == null || deleting) return
        deleting = true; deleteError = null
        scope.launch {
            try {
                client.remove(request.id)
                haptic.performHapticFeedback(HapticFeedbackType.ContextClick)
                setRoute(Route.Mine)
            } catch (e: CancellationException) { throw e } catch (e: Exception) {
                val ye = e as? YouAskedException
                deleteError = errorText(ye?.code ?: "network", ye?.detail)
                deleting = false
            }
        }
    }

    fun toggleEarly() {
        if (request == null) return
        val before = early
        haptic.performHapticFeedback(HapticFeedbackType.ContextClick)
        early = !before
        scope.launch {
            try { early = client.earlyAccess(request.id) } catch (e: CancellationException) { throw e } catch (e: Exception) { early = before }
        }
    }

    fun send() {
        val body = reply.trim()
        if (body.isEmpty() || sending || request == null || data == null) return
        sending = true; replyError = null
        scope.launch {
            try {
                val c = client.comment(request.id, body)
                load.setData(data.copy(comments = comments + c, request = request.copy(comments = request.comments + 1)))
                reply = ""
                haptic.performHapticFeedback(HapticFeedbackType.ContextClick)
                delay(80)
                scroll.animateScrollTo(scroll.maxValue)
            } catch (e: CancellationException) { throw e } catch (e: Exception) {
                replyError = errorText((e as? YouAskedException)?.code ?: "network")
            } finally { sending = false }
        }
    }

    Column(Modifier.fillMaxSize()) {
        Header("", onBack = { setRoute(
            when (from ?: Route.From.Board) { Route.From.Home -> Route.Home(); Route.From.Board -> Route.Board(); Route.From.Mine -> Route.Mine },
        ) }, onClose = onClose)
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(scroll).padding(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 18.dp),
        ) {
            when {
                load.error != null -> Empty(
                    if (load.error == "not_found") "This request was removed." else "Couldn't load this request",
                    if (load.error == "not_found") null else errorText(load.error),
                )
                request == null -> Skeleton()
                else -> {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (request.status != Status.Open) StatusPill(request.status)
                        T("YA-${request.number}", size = 12f, weight = SemiBold, color = t.muted, letterSpacing = 0.3f)
                    }
                    T(request.title, size = 21f, weight = Bold, letterSpacing = -0.3f, lineHeight = 27f,
                        modifier = Modifier.padding(top = 10.dp, bottom = 8.dp).semantics { heading() })
                    if (request.body.isNotEmpty() && request.body != request.title) T(request.body, lineHeight = 21f)
                    data.attachments.forEach { a ->
                        val bmp by androidx.compose.runtime.produceState<androidx.compose.ui.graphics.ImageBitmap?>(null, a.url) { value = loadBitmap(a.url) }
                        Box(Modifier.fillMaxWidth().padding(top = 12.dp).height(200.dp).clip(RoundedCornerShape(t.radius)).background(t.surface)) {
                            bmp?.let { Image(it, "Screenshot attached to this request", Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
                        }
                    }
                    BigVote(client, request) { voted = it }
                    if ((request.status == Status.Planned || request.status == Status.InProgress) && (voted ?: request.voted)) {
                        Row(
                            Modifier.fillMaxWidth().padding(top = 12.dp).clip(RoundedCornerShape(t.radius)).background(t.surface)
                                .tap({ toggleEarly() }, scale = false, role = Role.Switch)
                                .semantics { stateDescription = if (early) "On" else "Off" }
                                .padding(start = 12.dp, end = 14.dp, top = 10.dp, bottom = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Box(
                                Modifier.size(32.dp).clip(RoundedCornerShape(11.dp)).background(if (early) t.accent else t.tint),
                                contentAlignment = Alignment.Center,
                            ) { IconSpark(if (early) t.accentFg else t.accent, 17.dp) }
                            Column(Modifier.weight(1f)) {
                                T("Try it early", size = 15.5f, weight = SemiBold)
                                T(if (early) "You're on the list. We'll let you in first." else "Get access before everyone else", size = 13f, color = t.muted)
                            }
                            Toggle(early)
                        }
                    }
                    if (request.mine && request.status != Status.Shipped) {
                        T("You asked for this. We'll tell you here when it ships.", size = 13.5f, color = t.muted, lineHeight = 19f, modifier = Modifier.padding(top = 10.dp))
                    }
                    if (data.canDelete) {
                        if (confirmDelete) {
                            Column(Modifier.padding(top = 10.dp)) {
                                T("Delete this request? This can't be undone.", size = 13.5f, color = t.muted, lineHeight = 19f)
                                Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Box(Modifier.tap({ remove() }, enabled = !deleting).padding(vertical = 4.dp)) {
                                        T(if (deleting) "Deleting…" else "Delete", size = 14f, weight = SemiBold, color = Color(0xFFE5484D))
                                    }
                                    Box(Modifier.tap({ confirmDelete = false }, enabled = !deleting).padding(vertical = 4.dp)) {
                                        T("Keep it", size = 14f, weight = SemiBold, color = t.accent)
                                    }
                                }
                            }
                        } else {
                            Box(Modifier.padding(top = 10.dp).tap({ confirmDelete = true }).padding(vertical = 4.dp)) {
                                T("Delete my request", size = 14f, weight = FontWeightMedium, color = t.muted)
                            }
                        }
                    }
                    if (deleteError != null) T(deleteError!!, size = 13.5f, color = t.muted, lineHeight = 19f, modifier = Modifier.padding(top = 10.dp))
                    if (request.status == Status.Shipped) {
                        Row(
                            Modifier.fillMaxWidth().padding(top = 14.dp).clip(RoundedCornerShape(t.radius)).background(t.greenTint).padding(12.dp, 12.dp, 14.dp, 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.Top,
                        ) {
                            GreenDot(20.dp)
                            T(
                                rich(
                                    "It's live." to true,
                                    (if (request.shipNote != null) " ${request.shipNote}" else " Thanks for asking.") to false,
                                    (if (request.creditName != null) "\nThanks to ${request.creditName} for asking." else "") to false,
                                ),
                                size = 14f, lineHeight = 20f, modifier = Modifier.weight(1f),
                            )
                        }
                    }
                    T("Conversation", size = 13f, weight = SemiBold, color = t.muted, modifier = Modifier.padding(top = 26.dp, bottom = 6.dp).semantics { heading() })
                    if (comments.isEmpty()) {
                        T("No messages yet. Add details or ask a question below.", color = t.muted, lineHeight = 21f)
                    } else {
                        Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            comments.forEach { c -> Message(c, ui.appName, ui.appIcon) }
                        }
                    }
                }
            }
        }
        if (request != null) {
            Column(Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 10.dp)) {
                Composer(
                    value = reply, onValueChange = { reply = it }, placeholder = "Message", label = "Message", maxLength = 1000,
                    canSend = reply.trim().isNotEmpty() && !sending, sendLabel = "Send comment", onSend = ::send,
                )
                if (replyError != null) T(replyError!!, size = 13.5f, color = t.muted, lineHeight = 19f, modifier = Modifier.padding(top = 10.dp).semantics { liveRegion = LiveRegionMode.Assertive })
            }
        }
    }
}

/** Team replies read as messages from the app, yours sit on the right like any chat. */
@Composable
private fun Message(comment: RequestComment, appName: String, appIcon: YouAskedIcon?) {
    val t = ui().theme
    val who = if (comment.mine) "You" else if (comment.team) "$appName team" else comment.author ?: "Someone"
    val whenText = ago(comment.createdAt)
    Column(Modifier.semantics(mergeDescendants = true) { contentDescription = "$who, $whenText: ${comment.body}" }) {
        if (comment.mine) {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Bubble(tone = Tone.Out, animate = false) { T(comment.body, color = t.accentFg, lineHeight = 21f) }
                T(whenText, size = 12f, color = t.muted, modifier = Modifier.padding(horizontal = 4.dp))
            }
        } else {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
                if (comment.team && appIcon != null) AppAvatar(appIcon, 26.dp, round = true)
                Column(Modifier.weight(1f, fill = false), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Row(Modifier.padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        T(if (comment.team) appName else comment.author ?: "Someone", size = 12f, weight = Bold)
                        if (comment.team) {
                            Box(Modifier.clip(CircleShape).background(t.accent).padding(horizontal = 7.dp, vertical = 1.dp)) {
                                T("Team", size = 11f, weight = Bold, color = t.accentFg)
                            }
                        }
                        T(whenText, size = 12f, color = t.muted)
                    }
                    Bubble(animate = false) { T(comment.body, lineHeight = 21f) }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- yours

@Composable
private fun Mine(setRoute: (Route) -> Unit, onClose: (() -> Unit)?) {
    val ui = ui()
    val t = ui.theme
    val client = ui.client
    val load = rememberLoad(client) { client.mine() }
    Column(Modifier.fillMaxSize()) {
        Header("Your requests", onBack = { setRoute(Route.Board()) }, onClose = onClose)
        RequestList(
            load = load,
            emptyTitle = "Nothing yet",
            emptyText = "Requests you post or vote on show up here, with their status.",
            errorTitle = "Couldn't load your requests",
            from = Route.From.Mine,
            setRoute = setRoute,
            modifier = Modifier.weight(1f),
        )
        Foot { Button("Request a feature", { setRoute(Route.Home(focus = true)) }, Modifier.fillMaxWidth(), icon = { IconPlus(t.accentFg) }) }
    }
}
