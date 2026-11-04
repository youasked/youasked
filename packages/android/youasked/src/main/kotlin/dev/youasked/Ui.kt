package dev.youasked

import android.graphics.BitmapFactory
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.layout.ContentScale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URL

/** The app's own icon for the sheet header and team replies. */
public sealed class YouAskedIcon {
    public class Resource(public val id: Int) : YouAskedIcon()
    public class Url(public val url: String) : YouAskedIcon()
    public class Custom(public val painter: Painter) : YouAskedIcon()
}

internal class Ui(
    val ctl: Controller,
    val theme: Theme,
    val appName: String,
    val appIcon: YouAskedIcon?,
    val title: String,
    val greeting: String?,
    val capture: (suspend () -> ByteArray?)?,
) {
    val client: Client get() = ctl.client
}

internal val LocalUi = compositionLocalOf<Ui?> { null }

@Composable
internal fun ui(): Ui = LocalUi.current ?: error("YouAsked components must be placed inside YouAskedHost { ... }")

// ---------------------------------------------------------------- text

@Composable
internal fun T(
    text: String,
    modifier: Modifier = Modifier,
    size: Float = 15f,
    weight: FontWeight = FontWeight.Normal,
    color: Color? = null,
    lineHeight: Float? = null,
    letterSpacing: Float = 0f,
    maxLines: Int = Int.MAX_VALUE,
    align: TextAlign? = null,
    tabular: Boolean = false,
) = T(AnnotatedString(text), modifier, size, weight, color, lineHeight, letterSpacing, maxLines, align, tabular)

@Composable
internal fun T(
    text: AnnotatedString,
    modifier: Modifier = Modifier,
    size: Float = 15f,
    weight: FontWeight = FontWeight.Normal,
    color: Color? = null,
    lineHeight: Float? = null,
    letterSpacing: Float = 0f,
    maxLines: Int = Int.MAX_VALUE,
    align: TextAlign? = null,
    tabular: Boolean = false,
) {
    val theme = ui().theme
    Text(
        text = text,
        modifier = modifier,
        color = color ?: theme.fg,
        maxLines = maxLines,
        overflow = if (maxLines == Int.MAX_VALUE) TextOverflow.Clip else TextOverflow.Ellipsis,
        textAlign = align,
        style = TextStyle(
            fontSize = size.sp,
            fontWeight = weight,
            fontFamily = theme.fontFamily,
            lineHeight = lineHeight?.sp ?: TextUnit.Unspecified,
            letterSpacing = letterSpacing.sp,
            fontFeatureSettings = if (tabular) "tnum" else null,
        ),
    )
}

internal val SemiBold = FontWeight.SemiBold
internal val Bold = FontWeight.Bold

// ---------------------------------------------------------------- touch

/** Dims slightly while held, the way native buttons do. */
@Composable
internal fun Modifier.tap(
    onClick: () -> Unit,
    enabled: Boolean = true,
    scale: Boolean = true,
    role: Role? = Role.Button,
    label: String? = null,
): Modifier {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    return this
        .graphicsLayer {
            val on = pressed && enabled
            alpha = if (on) 0.8f else 1f
            val s = if (on && scale) 0.97f else 1f
            scaleX = s
            scaleY = s
        }
        .clickable(interactionSource = source, indication = null, enabled = enabled, role = role, onClick = onClick)
        .then(if (label != null) Modifier.semantics { contentDescription = label } else Modifier)
}

// ---------------------------------------------------------------- data

internal class Load<T>(
    val data: T?,
    val error: String?,
    val refreshing: Boolean,
    val refresh: () -> Unit,
    val setData: (T) -> Unit,
)

@Composable
internal fun <T> rememberLoad(key: Any?, load: suspend () -> T): Load<T> {
    var data by remember(key) { mutableStateOf<T?>(null) }
    var error by remember(key) { mutableStateOf<String?>(null) }
    var tick by remember(key) { mutableStateOf(0) }
    var refreshing by remember(key) { mutableStateOf(false) }
    LaunchedEffect(key, tick) {
        error = null
        try {
            data = load()
        } catch (e: YouAskedException) {
            error = e.code
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            error = "network"
        }
        refreshing = false
    }
    return Load(data, error, refreshing, { refreshing = true; tick++ }, { data = it })
}

internal fun errorText(code: String?, detail: String? = null): String {
    if (!detail.isNullOrEmpty()) return detail
    return when (code) {
        "signature_required", "bad_signature" -> "We couldn't confirm who you are. Restart the app and try again."
        "slow_down" -> "That's a lot of requests in an hour. Try again a bit later."
        "title_too_short" -> "Add a few more words so others know what you mean."
        "network" -> "Couldn't reach the server. Check your connection and try again."
        else -> "Something went wrong. Try again."
    }
}

internal fun whatsNewHeading(total: Int) = "$total ${if (total == 1) "thing" else "things"} shipped since your last visit"

internal fun ago(t: Long, now: Long = System.currentTimeMillis()): String {
    val s = maxOf(0L, Math.round((now - t) / 1000.0))
    if (s < 60) return "just now"
    val m = Math.round(s / 60.0)
    if (m < 60) return "${m}m ago"
    val h = Math.round(m / 60.0)
    if (h < 24) return "${h}h ago"
    val d = Math.round(h / 24.0)
    if (d < 30) return "${d}d ago"
    return java.text.SimpleDateFormat("MMM d", java.util.Locale.getDefault()).format(java.util.Date(t))
}

// ---------------------------------------------------------------- votes

internal class VoteState(val voted: Boolean, val votes: Int, val toggle: () -> Unit)

@Composable
internal fun rememberVote(client: Client, request: FeatureRequest): VoteState {
    var voted by remember(request.id, request.voted, request.votes) { mutableStateOf(request.voted) }
    var votes by remember(request.id, request.voted, request.votes) { mutableStateOf(request.votes) }
    var busy by remember { mutableStateOf(false) }
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    return VoteState(voted, votes) {
        if (!busy) {
            busy = true
            val (v0, n0) = voted to votes
            haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.ContextClick)
            voted = !v0
            votes = n0 + if (v0) -1 else 1
            scope.launch {
                try {
                    val r = client.vote(request.id)
                    voted = r.voted
                    votes = r.votes
                } catch (e: kotlinx.coroutines.CancellationException) {
                    throw e
                } catch (e: Exception) {
                    voted = v0
                    votes = n0
                } finally {
                    busy = false
                }
            }
        }
    }
}

/** A quick squash and spring when a value flips on. */
@Composable
private fun rememberPop(on: Boolean): Float {
    val scale = remember { Animatable(1f) }
    var first by remember { mutableStateOf(true) }
    LaunchedEffect(on) {
        if (first) { first = false; return@LaunchedEffect }
        if (!on) return@LaunchedEffect
        scale.animateTo(1.14f, tween(90))
        scale.animateTo(1f, spring(dampingRatio = 0.4f, stiffness = 400f))
    }
    return scale.value
}

@Composable
internal fun VoteButton(client: Client, request: FeatureRequest, compact: Boolean = false) {
    val t = ui().theme
    val v = rememberVote(client, request)
    val pop = rememberPop(v.voted)
    val color = if (v.voted) t.accentFg else t.fg
    val shape = RoundedCornerShape(maxOf(t.radius.value - 4f, 6f).dp)
    val votesWord = if (v.votes == 1) "vote" else "votes"
    Column(
        Modifier
            .graphicsLayer { scaleX = pop; scaleY = pop }
            .width(if (compact) 40.dp else 46.dp)
            .clip(shape)
            .background(if (v.voted) t.accent else t.bg)
            .border(1.dp, if (v.voted) t.accent else t.border, shape)
            .clickable(role = Role.Button, onClick = v.toggle)
            .semantics {
                contentDescription = "${if (v.voted) "Remove vote" else "Upvote"}: ${request.title}. ${v.votes} $votesWord"
                selected = v.voted
            }
            .padding(vertical = if (compact) 3.dp else 5.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        IconUp(color, if (compact) 14.dp else 16.dp)
        T("${v.votes}", size = if (compact) 13f else 14f, weight = Bold, color = color, lineHeight = if (compact) 16f else 17f, tabular = true)
    }
}

@Composable
internal fun BigVote(client: Client, request: FeatureRequest, onChange: (Boolean) -> Unit) {
    val t = ui().theme
    val v = rememberVote(client, request)
    val pop = rememberPop(v.voted)
    LaunchedEffect(v.voted) { onChange(v.voted) }
    val color = if (v.voted) t.accentFg else t.fg
    val shape = RoundedCornerShape(t.buttonRadius ?: 999.dp)
    Row(
        Modifier
            .padding(top = 16.dp)
            .graphicsLayer { scaleX = pop; scaleY = pop }
            .height(40.dp)
            .clip(shape)
            .background(if (v.voted) t.accent else Color.Transparent)
            .border(1.dp, if (v.voted) t.accent else t.border, shape)
            .clickable(role = Role.Button, onClick = v.toggle)
            .semantics { selected = v.voted }
            .padding(start = 12.dp, end = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        IconUp(color, 17.dp)
        T("${if (v.voted) "Voted" else "Upvote"} · ${v.votes}", size = 14.5f, weight = Bold, color = color, tabular = true)
    }
}

// ---------------------------------------------------------------- small pieces

@Composable
internal fun StatusPill(status: Status) {
    val t = ui().theme
    val (bg, fg) = when (status) {
        Status.Planned -> t.tint to t.accent
        Status.InProgress -> t.amberTint to t.amber
        Status.Shipped -> t.greenTint to t.green
        else -> t.bg to t.muted
    }
    Row(
        Modifier.clip(CircleShape).background(bg).padding(horizontal = 8.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        if (status == Status.Shipped) IconCheck(fg, 11.dp)
        T(status.label, size = 12f, weight = SemiBold, color = fg)
    }
}

@Composable
internal fun GreenDot(size: Dp = 22.dp) {
    val t = ui().theme
    Box(Modifier.size(size).clip(CircleShape).background(mix(t.green, t.bg, 0.16f)), contentAlignment = Alignment.Center) {
        IconCheck(t.green, 13.dp)
    }
}

@Composable
internal fun RequestRow(client: Client, request: FeatureRequest, onOpen: () -> Unit, compact: Boolean = false, onTint: Boolean = false) {
    val t = ui().theme
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(t.radius))
            .background(if (onTint) t.bg else t.surface)
            .padding(vertical = if (compact) 8.dp else 10.dp, horizontal = if (compact) 10.dp else 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (compact) 10.dp else 12.dp),
    ) {
        VoteButton(client, request, compact)
        Column(
            Modifier.weight(1f).tap(onOpen, scale = false).padding(vertical = 2.dp).semantics(mergeDescendants = true) {},
        ) {
            T(request.title, size = if (compact) 14.5f else 15f, weight = SemiBold, lineHeight = 20f)
            if (request.status != Status.Open || request.comments > 0 || request.mine) {
                Row(
                    Modifier.padding(top = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (request.status != Status.Open) StatusPill(request.status)
                    if (request.comments > 0) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            modifier = Modifier.semantics(mergeDescendants = true) {
                                contentDescription = "${request.comments} ${if (request.comments == 1) "comment" else "comments"}"
                            },
                        ) {
                            IconChat(t.muted, 13.dp)
                            T("${request.comments}", size = 12.5f, color = t.muted)
                        }
                    }
                    if (request.mine) T("You asked", size = 12.5f, color = t.muted)
                }
            }
        }
    }
}

@Composable
internal fun Skeleton(rows: Int = 3) {
    val t = ui().theme
    val a by rememberInfiniteTransition(label = "skeleton").animateFloat(
        0.55f, 1f, infiniteRepeatable(tween(650), RepeatMode.Reverse), label = "skeleton-alpha",
    )
    Column(
        Modifier.semantics { contentDescription = "Loading" },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        repeat(rows) {
            Box(Modifier.fillMaxWidth().height(58.dp).alpha(a).clip(RoundedCornerShape(t.radius)).background(t.surface))
        }
    }
}

@Composable
internal fun Badge(count: Int) {
    Box(
        Modifier.defaultMinSize20().clip(CircleShape).background(Color(0xFFFF3B30)).padding(horizontal = 6.dp),
        contentAlignment = Alignment.Center,
    ) { T("$count", size = 12f, weight = Bold, color = Color.White) }
}

private fun Modifier.defaultMinSize20() = this.then(Modifier.height(20.dp).widthIn(min = 20.dp))

@Composable
internal fun Empty(title: String, text: String? = null) {
    Column(Modifier.fillMaxWidth().padding(vertical = 44.dp, horizontal = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        T(title, size = 16f, weight = Bold, modifier = Modifier.padding(bottom = 4.dp))
        if (text != null) T(text, size = 14.5f, color = ui().theme.muted, align = TextAlign.Center, lineHeight = 20f)
    }
}

@Composable
internal fun rememberIconPainter(icon: YouAskedIcon?): Painter? = when (icon) {
    null -> null
    is YouAskedIcon.Custom -> icon.painter
    is YouAskedIcon.Resource -> painterResource(icon.id)
    is YouAskedIcon.Url -> {
        val bmp by produceState<ImageBitmap?>(null, icon.url) { value = loadBitmap(icon.url) }
        bmp?.let { remember(it) { BitmapPainter(it) } }
    }
}

internal suspend fun loadBitmap(url: String): ImageBitmap? = withContext(Dispatchers.IO) {
    runCatching {
        URL(url).openStream().use { BitmapFactory.decodeStream(it)?.asImageBitmap() }
    }.getOrNull()
}

/** The app's own icon, or nothing. A guessed letter tile looks generic, so it's never drawn. */
@Composable
internal fun AppAvatar(icon: YouAskedIcon?, size: Dp = 36.dp, round: Boolean = false) {
    val painter = rememberIconPainter(icon) ?: return
    Image(
        painter, contentDescription = null, contentScale = ContentScale.Crop,
        modifier = Modifier.size(size).clip(if (round) CircleShape else RoundedCornerShape(size * 0.24f)).background(ui().theme.surface),
    )
}

@Composable
internal fun CircleIconButton(label: String, onClick: () -> Unit, plain: Boolean = false, size: Dp = 34.dp, content: @Composable () -> Unit) {
    val t = ui().theme
    Box(
        Modifier.minimumInteractiveComponentSize().tap(onClick, label = label),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier.size(size).clip(CircleShape).background(if (plain) Color.Transparent else t.surface),
            contentAlignment = Alignment.Center,
        ) { content() }
    }
}

@Composable
internal fun Header(
    title: String,
    subtitle: String? = null,
    leading: @Composable (() -> Unit)? = null,
    onBack: (() -> Unit)? = null,
    onClose: (() -> Unit)? = null,
    right: @Composable (() -> Unit)? = null,
) {
    val t = ui().theme
    Row(
        Modifier.fillMaxWidth().padding(top = 2.dp, bottom = 2.dp, end = 8.dp, start = if (onBack != null) 4.dp else 18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (onBack != null) 2.dp else 10.dp),
    ) {
        if (onBack != null) CircleIconButton("Back", onBack, plain = true) { IconBack(t.muted) }
        leading?.invoke()
        Column(Modifier.weight(1f)) {
            T(title, size = 17f, weight = Bold, letterSpacing = -0.2f, maxLines = 1, modifier = Modifier.semantics { heading() })
            if (subtitle != null) T(subtitle, size = 12.5f, color = t.muted, modifier = Modifier.padding(top = 1.dp))
        }
        right?.invoke()
        if (onClose != null) CircleIconButton("Close", onClose) { IconClose(t.muted, 17.dp) }
    }
}

@Composable
internal fun LinkButton(label: String, onClick: () -> Unit, chevron: Boolean = false) {
    val t = ui().theme
    Row(
        Modifier.minimumInteractiveComponentSize().tap(onClick).padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        T(label, size = 14f, weight = SemiBold, color = t.accent)
        if (chevron) IconChevron(t.accent, 15.dp)
    }
}

@Composable
internal fun Button(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    small: Boolean = false,
    ghost: Boolean = false,
    icon: (@Composable () -> Unit)? = null,
) {
    val t = ui().theme
    val shape = RoundedCornerShape(t.buttonRadius ?: if (small) maxOf(t.radius.value - 3f, 8f).dp else t.radius)
    val fg = if (ghost) t.fg else t.accentFg
    Row(
        modifier
            .height(if (small) 38.dp else 48.dp)
            .clip(shape)
            .background(if (ghost) t.surface else t.accent)
            .tap(onClick)
            .padding(horizontal = if (small) 14.dp else 18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
    ) {
        icon?.invoke()
        T(label, size = if (small) 14f else 15f, weight = Bold, color = fg)
    }
}

/** A small switch, drawn to match the rest. */
@Composable
internal fun Toggle(on: Boolean) {
    val t = ui().theme
    val x = remember { Animatable(if (on) 14f else 0f) }
    LaunchedEffect(on) { x.animateTo(if (on) 14f else 0f, spring(0.6f, Spring.StiffnessMedium)) }
    Box(
        Modifier.size(34.dp, 20.dp).clip(RoundedCornerShape(10.dp)).background(if (on) t.accent else mix(t.fg, t.bg, 0.18f)),
    ) {
        Box(
            Modifier.padding(start = 2.dp, top = 2.dp)
                .graphicsLayer { translationX = x.value * density }
                .shadow(2.dp, CircleShape)
                .size(16.dp).clip(CircleShape).background(Color.White),
        )
    }
}

@Composable
internal fun Section(title: String, action: String? = null, onAction: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    val t = ui().theme
    Column(Modifier.padding(top = 12.dp)) {
        Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            T(title, size = 13f, weight = SemiBold, color = t.muted, modifier = Modifier.semantics { heading() })
            if (action != null) LinkButton(action, onAction ?: {}, chevron = true)
        }
        content()
    }
}

internal enum class Tone { In, Out, Win, Error }

/** A chat bubble. Springs in when it first shows. */
@Composable
internal fun Bubble(
    tone: Tone = Tone.In,
    stretch: Boolean = false,
    animate: Boolean = true,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val t = ui().theme
    val v = remember { Animatable(if (animate) 0f else 1f) }
    LaunchedEffect(Unit) { if (animate) v.animateTo(1f, spring(dampingRatio = 0.65f, stiffness = 380f)) }
    val out = tone == Tone.Out
    val shape = RoundedCornerShape(
        topStart = 20.dp, topEnd = 20.dp,
        bottomStart = if (out) 20.dp else 6.dp, bottomEnd = if (out) 6.dp else 20.dp,
    )
    val bg = when (tone) { Tone.Out -> t.accent; Tone.Win -> t.greenTint; Tone.Error -> t.redTint; Tone.In -> t.surface }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        Column(
            modifier
                .align(if (out) Alignment.CenterEnd else Alignment.CenterStart)
                .then(if (stretch) Modifier.fillMaxWidth() else Modifier.widthIn(max = maxWidth * 0.86f))
                .graphicsLayer {
                    val s = 0.92f + 0.08f * v.value
                    alpha = v.value.coerceIn(0f, 1f); scaleX = s; scaleY = s
                    transformOrigin = androidx.compose.ui.graphics.TransformOrigin(if (out) 1f else 0f, 1f)
                }
                .clip(shape)
                .background(bg)
                .padding(vertical = 10.dp, horizontal = 14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            content = content,
        )
    }
}

/** Text with some parts in bold: `rich("You asked for " to false, title to true, ". It's live." to false)`. */
internal fun rich(vararg parts: Pair<String, Boolean>): AnnotatedString = AnnotatedString.Builder().apply {
    parts.forEach { (s, b) ->
        if (b) pushStyle(androidx.compose.ui.text.SpanStyle(fontWeight = Bold))
        append(s)
        if (b) pop()
    }
}.toAnnotatedString()
