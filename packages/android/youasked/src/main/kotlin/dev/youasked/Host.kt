package dev.youasked

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.LocalTextSelectionColors
import androidx.compose.foundation.text.selection.TextSelectionColors
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect

public enum class LauncherTrigger {
    /** A floating button in the corner. */
    Floating,

    /** No button: use the inline entry points or your own buttons. */
    None,
}

public enum class LauncherPosition { BottomEnd, BottomStart }

/**
 * Put this once near the root of your UI (inside your theme, around your screens). It hosts the bottom
 * sheet, the "it's live" / reply / what's-new cards and the occasional nudge. Call [YouAsked.configure] first.
 *
 * ```
 * YouAskedHost { MyAppContent() }
 * ```
 */
@Composable
public fun YouAskedHost(
    modifier: Modifier = Modifier,
    appearance: YouAskedAppearance = YouAskedAppearance(),
    trigger: LauncherTrigger = LauncherTrigger.Floating,
    position: LauncherPosition = LauncherPosition.BottomEnd,
    /** Text next to the launcher icon. Leave null for an icon-only bubble. */
    label: String? = null,
    /** Your app's name in the greeting. Defaults to the name you created the app with. */
    appName: String? = null,
    /** Your app's icon, shown in the header and on team replies. */
    appIcon: YouAskedIcon? = null,
    /** First message on the home screen. */
    greeting: String? = null,
    /** Heading of the full list. */
    title: String = "Feature requests",
    /** Distance from the bottom edge for the launcher and cards, above the navigation bar. Use it to clear a tab bar. */
    offset: Dp = 20.dp,
    /** Show the card for replies, shipped requests and what's new. */
    cards: Boolean = true,
    nudge: YouAskedNudge = YouAskedNudge.Dashboard,
    /** Lets people attach a screenshot ("Show us"). Return PNG bytes you captured, or null if they cancel. Off when null. */
    captureScreenshot: (suspend () -> ByteArray?)? = null,
    content: @Composable () -> Unit,
) {
    val ctl = YouAsked.controller
    if (ctl == null) {
        content()
        return
    }
    val theme = resolveTheme(appearance, rememberSystemDark())
    val ui = Ui(ctl, theme, appName ?: ctl.config?.appName?.ifEmpty { null } ?: "us", appIcon, title, greeting, captureScreenshot)

    // Load /config now and again whenever the app comes back to the front (at most once a minute).
    LaunchedEffect(ctl.client, ctl.refreshTick) { ctl.loadConfig() }
    LifecycleEventEffect(Lifecycle.Event.ON_START) {
        if (System.currentTimeMillis() - ctl.lastLoad > 60_000) ctl.refreshTick++
    }

    CompositionLocalProvider(LocalUi provides ui) {
        Box(modifier) {
            content()
            if (!ctl.disabled) {
                MaterialTheme(colorScheme = if (theme.dark) darkColorScheme(primary = theme.accent, surface = theme.bg) else lightColorScheme(primary = theme.accent, surface = theme.bg)) {
                    CompositionLocalProvider(
                        LocalTextSelectionColors provides TextSelectionColors(theme.accent, theme.accent.copy(alpha = 0.3f)),
                    ) {
                        Overlays(ui, trigger, position, label, offset, cards, nudge)
                    }
                }
            }
        }
    }
}

@Composable
private fun BoxScope2.Overlays(
    ui: Ui, trigger: LauncherTrigger, position: LauncherPosition, label: String?, offset: Dp, cards: Boolean, nudge: YouAskedNudge,
) {
    val ctl = ui.ctl
    val route = ctl.route
    val unseen = ctl.config?.unseen.orEmpty()
    val whatsNew = ctl.whatsNew
    // "It's live" notices for things already in the what's-new list wait for that list instead of saying it twice.
    val standing = unseen.filterNot { Controller.coveredBy(whatsNew, it) }
    val notice = standing.firstOrNull { it.kind == "shipped" } ?: standing.firstOrNull { it.kind == "reply" }

    val settings = resolveNudge(ctl.config?.nudge, nudge)
    val context = ctl.context
    val nudgeState = remember(ctl, ctl.user?.id) { NudgeState(context, if (ctl.demo) null else "nudge:${ctl.appKey}:${ctl.user?.id ?: "anon"}") }
    val blocked = route != null || (cards && (notice != null || (ctl.whatsNewToast && whatsNew != null)))
    NudgeTimer(nudgeState, settings, blocked)
    LaunchedEffect(route != null) { if (route != null) nudgeState.engaged() }

    if (trigger == LauncherTrigger.Floating && route == null) {
        Launcher(ui, position, label, offset, unseen.isNotEmpty())
    }
    if (route == null && cards) {
        when {
            notice != null -> ShippedToast(ui, notice, position, trigger, offset)
            ctl.whatsNewToast && whatsNew != null -> WhatsNewToast(ui, whatsNew, position, trigger, offset)
            nudgeState.show && settings != null -> NudgeToast(ui, settings, nudgeState, position, trigger, offset)
        }
    } else if (route == null && nudgeState.show && settings != null) {
        NudgeToast(ui, settings, nudgeState, position, trigger, offset)
    }
    if (route != null) SheetHost(ui)
}

private typealias BoxScope2 = androidx.compose.foundation.layout.BoxScope

// ---------------------------------------------------------------- the sheet

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SheetHost(ui: Ui) {
    val ctl = ui.ctl
    val t = ui.theme
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val startTick = remember { ctl.closeTick }
    LaunchedEffect(ctl.closeTick) {
        if (ctl.closeTick != startTick) {
            state.hide()
            ctl.route = null
        }
    }
    val route = ctl.route ?: return
    val density = LocalDensity.current
    val screenH = LocalConfiguration.current.screenHeightDp
    val ime = with(density) { WindowInsets.ime.getBottom(density).toDp() }
    val nav = with(density) { WindowInsets.navigationBars.getBottom(density).toDp() }
    val top = with(density) { WindowInsets.statusBars.getTop(density).toDp() }
    val sheetH = minOf(screenH * 0.9f, 760f).dp
    // The sheet grows by the keyboard's height so the visible part keeps its size and the composer sits on the keyboard.
    val total = minOf(sheetH + (ime - nav).coerceAtLeast(0.dp), (screenH.dp - maxOf(top, 36.dp) - 24.dp))
    val corner = t.radius + 10.dp

    // Back steps out of a screen before it closes the sheet.
    BackHandler(enabled = route !is Route.Home) {
        ctl.route = when (route) {
            is Route.Detail -> when (route.from) { Route.From.Home -> Route.Home(); Route.From.Mine -> Route.Mine; else -> Route.Board() }
            is Route.Mine -> Route.Board()
            else -> Route.Home()
        }
    }

    ModalBottomSheet(
        onDismissRequest = { ctl.route = null },
        sheetState = state,
        sheetMaxWidth = 520.dp,
        shape = RoundedCornerShape(topStart = corner, topEnd = corner),
        containerColor = t.bg,
        contentColor = t.fg,
        scrimColor = Color(0x6B080A14),
        tonalElevation = 0.dp,
        contentWindowInsets = { WindowInsets(0, 0, 0, 0) },
        dragHandle = {
            Box(Modifier.fillMaxWidth().padding(top = 7.dp, bottom = 2.dp), contentAlignment = Alignment.Center) {
                Box(Modifier.size(38.dp, 5.dp).clip(CircleShape).background(mix(t.fg, t.bg, 0.2f)))
            }
        },
    ) {
        CompositionLocalProvider(LocalUi provides ui) {
            androidx.compose.foundation.layout.BoxWithConstraints {
            val h = minOf(total - 14.dp, maxHeight - 24.dp)
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(h)
                    .windowInsetsPadding(WindowInsets.ime.union(WindowInsets.navigationBars).only(WindowInsetsSides.Bottom)),
            ) {
                Navigator(route, { ctl.route = it }, { ctl.requestClose() })
            }
            }
        }
    }
}

// ---------------------------------------------------------------- launcher and cards

@Composable
private fun BoxScope2.Launcher(ui: Ui, position: LauncherPosition, label: String?, offset: Dp, badge: Boolean) {
    val t = ui.theme
    val v = remember { Animatable(0f) }
    LaunchedEffect(Unit) { v.animateTo(1f, spring(dampingRatio = 0.5f, stiffness = 220f)) }
    Box(
        Modifier
            .align(if (position == LauncherPosition.BottomStart) Alignment.BottomStart else Alignment.BottomEnd)
            .windowInsetsPadding(WindowInsets.systemBars.only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal))
            .padding(start = 20.dp, end = 20.dp, bottom = offset)
            .graphicsLayer { alpha = v.value.coerceIn(0f, 1f); scaleX = v.value; scaleY = v.value },
    ) {
        Row(
            Modifier
                .height(56.dp)
                .shadow(8.dp, CircleShape)
                .clip(CircleShape)
                .background(t.accent)
                .tap(ui.ctl::openDefault, label = label ?: "Feature requests")
                .then(if (label != null) Modifier.padding(start = 16.dp, end = 20.dp) else Modifier.size(56.dp)),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        ) {
            IconIdea(t.accentFg, t.accent, 26.dp)
            if (label != null) T(label, size = 15f, weight = Bold, color = t.accentFg)
        }
        if (badge) {
            Box(
                Modifier.align(Alignment.TopEnd).padding(top = 3.dp, end = 3.dp).size(10.dp)
                    .background(Color(0xFFFF3B30), CircleShape).border(2.dp, t.accent, CircleShape),
            )
        }
    }
}

internal fun Controller.openDefault() = open(OpenOptions())

@Composable
private fun BoxScope2.ToastShell(
    ui: Ui,
    kicker: String,
    onDismiss: () -> Unit,
    position: LauncherPosition,
    trigger: LauncherTrigger,
    offset: Dp,
    top: Boolean = false,
    content: @Composable () -> Unit,
) {
    val t = ui.theme
    val lift = if (trigger == LauncherTrigger.Floating) 68.dp else 0.dp
    val visible = remember { MutableTransitionState(false).apply { targetState = true } }
    Box(
        Modifier
            .align(
                when {
                    top -> if (position == LauncherPosition.BottomStart) Alignment.TopStart else Alignment.TopCenter
                    position == LauncherPosition.BottomStart -> Alignment.BottomStart
                    else -> Alignment.BottomCenter
                },
            )
            .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal + if (top) WindowInsetsSides.Top else WindowInsetsSides.Bottom))
            .padding(start = 16.dp, end = 16.dp, top = if (top) 16.dp else 0.dp, bottom = if (top) 0.dp else offset + lift),
    ) {
        AnimatedVisibility(
            visibleState = visible,
            enter = fadeIn() + slideInVertically(spring(0.6f, Spring.StiffnessMediumLow)) { if (top) -it / 4 else it / 4 },
            exit = fadeOut() + slideOutVertically { it / 4 },
        ) {
            val shape = RoundedCornerShape(t.radius + 6.dp)
            Column(
                Modifier
                    .widthIn(max = 400.dp)
                    .fillMaxWidth()
                    .shadow(16.dp, shape)
                    .clip(shape)
                    .background(t.bg)
                    .border(1.dp, t.border, shape)
                    .semantics { liveRegion = LiveRegionMode.Polite }
                    .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 14.dp),
            ) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    T(kicker, size = 12.5f, weight = SemiBold, color = t.muted)
                    Box(Modifier.padding(4.dp).tap(onDismiss, label = "Dismiss")) { IconClose(t.muted, 18.dp) }
                }
                content()
            }
        }
    }
}

@Composable
private fun BoxScope2.ShippedToast(ui: Ui, notice: Notice, position: LauncherPosition, trigger: LauncherTrigger, offset: Dp) {
    val t = ui.theme
    val ctl = ui.ctl
    val haptic = LocalHapticFeedback.current
    LaunchedEffect(notice.id) { haptic.performHapticFeedback(HapticFeedbackType.Confirm) }
    val reply = notice.kind == "reply"
    ToastShell(ui, if (reply) "New reply about" else "You asked for", { ctl.markSeen(listOf(notice.id)) }, position, trigger, offset) {
        T(notice.title, size = 17f, weight = FontWeightExtraBold, letterSpacing = -0.2f, lineHeight = 22f, modifier = Modifier.padding(top = 3.dp))
        if (reply) {
            T(notice.reply.orEmpty(), size = 13.5f, lineHeight = 19f, maxLines = 3, modifier = Modifier.padding(top = 6.dp))
        } else {
            Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                IconCheck(t.green, 15.dp)
                T("It's live", size = 14f, weight = Bold, color = t.green)
            }
            if (notice.shipNote != null) T(notice.shipNote, size = 13.5f, color = t.muted, lineHeight = 19f, modifier = Modifier.padding(top = 6.dp))
        }
        Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(if (reply) "Reply" else "See it", {
                ctl.markSeen(listOf(notice.id))
                ctl.open(OpenOptions(requestId = notice.requestId))
            }, small = true)
            Button(if (reply) "Later" else "Nice", { ctl.markSeen(listOf(notice.id)) }, small = true, ghost = true)
        }
    }
}

internal val FontWeightExtraBold = androidx.compose.ui.text.font.FontWeight.ExtraBold

@Composable
private fun BoxScope2.WhatsNewToast(ui: Ui, news: WhatsNew, position: LauncherPosition, trigger: LauncherTrigger, offset: Dp) {
    val t = ui.theme
    val ctl = ui.ctl
    val haptic = LocalHapticFeedback.current
    val mine = news.items.any { it.mine }
    LaunchedEffect(mine) { if (mine) haptic.performHapticFeedback(HapticFeedbackType.Confirm) }
    ToastShell(ui, "What's new", { ctl.dismissWhatsNew() }, position, trigger, offset) {
        T(whatsNewHeading(news.total), size = 17f, weight = FontWeightExtraBold, letterSpacing = -0.2f, lineHeight = 22f, modifier = Modifier.padding(top = 3.dp))
        if (mine) {
            Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                IconCheck(t.green, 15.dp)
                T("Including something you asked for", size = 14f, weight = Bold, color = t.green)
            }
        }
        Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button("See what's new", { ctl.open(OpenOptions()) }, small = true)
            Button("Not now", { ctl.dismissWhatsNew() }, small = true, ghost = true)
        }
    }
}

@Composable
private fun BoxScope2.NudgeToast(ui: Ui, settings: NudgeSettings, state: NudgeState, position: LauncherPosition, trigger: LauncherTrigger, offset: Dp) {
    val t = ui.theme
    val ctl = ui.ctl
    ToastShell(ui, "Help shape ${ui.appName}", { state.dismiss() }, position, trigger, offset, top = settings.position == NudgePosition.Top) {
        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Box(Modifier.size(36.dp).clip(RoundedCornerShape(11.dp)).background(t.tint), contentAlignment = Alignment.Center) {
                IconIdea(t.accent, t.bg, 20.dp)
            }
            Column(Modifier.weight(1f)) {
                T(settings.message ?: "Got an idea for ${ui.appName}?", size = 17f, weight = FontWeightExtraBold, letterSpacing = -0.2f, lineHeight = 22f)
                T("Ask for a feature or vote on what others want.", size = 13.5f, color = t.muted, lineHeight = 19f, modifier = Modifier.padding(top = 6.dp))
            }
        }
        Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button("Share an idea", { ctl.open(OpenOptions(view = OpenView.New)) }, small = true)
            Button("Not now", { state.dismiss() }, small = true, ghost = true)
        }
    }
}
