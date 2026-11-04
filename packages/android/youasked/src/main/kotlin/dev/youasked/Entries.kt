package dev.youasked

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// Inline entry points. Each renders inside your layout, inside YouAskedHost, and opens the same sheet.
// They render nothing while the app is in test mode for this build (or before YouAsked.configure).

/** A chat-style input bar. Tapping it opens the composer. Good at the top of a home screen or under an empty state. */
@Composable
public fun AskBar(modifier: Modifier = Modifier, placeholder: String = "Ask for a feature…") {
    val ui = LocalUi.current ?: return
    if (ui.ctl.disabled) return
    val t = ui.theme
    val unseen = ui.ctl.unseenCount
    val shape = RoundedCornerShape(t.buttonRadius ?: 999.dp)
    Row(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(t.bg)
            .border(1.dp, t.border, shape)
            .tap({ ui.ctl.open(OpenOptions(view = OpenView.New)) }, label = placeholder)
            .padding(top = 8.dp, bottom = 8.dp, start = 10.dp, end = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (ui.appIcon != null) AppAvatar(ui.appIcon, 30.dp)
        else Box(Modifier.size(30.dp).clip(CircleShape).background(t.tint), contentAlignment = Alignment.Center) { IconIdea(t.accent, t.bg, 18.dp) }
        T(placeholder, size = 15.5f, color = t.muted, maxLines = 1, modifier = Modifier.weight(1f))
        if (unseen > 0) Badge(unseen)
        Box(Modifier.size(34.dp).clip(CircleShape).background(t.accent), contentAlignment = Alignment.Center) { IconSend(t.accentFg, 17.dp) }
    }
}

/** A card with the top requests and vote buttons, for a dashboard or home tab. */
@Composable
public fun FeatureCard(
    modifier: Modifier = Modifier,
    heading: String = "Shape what's next",
    description: String = "Vote on ideas or suggest your own",
    limit: Int = 3,
) {
    val ui = LocalUi.current ?: return
    if (ui.ctl.disabled) return
    val t = ui.theme
    val ctl = ui.ctl
    val client = ui.client
    val load = rememberLoad(client) { client.list("top", "active") }
    val notice = ctl.config?.unseen?.firstOrNull { it.kind == "shipped" }
    Column(
        modifier.fillMaxWidth().clip(RoundedCornerShape(t.radius + 6.dp)).background(t.bg).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(36.dp).clip(RoundedCornerShape(11.dp)).background(t.tint), contentAlignment = Alignment.Center) { IconIdea(t.accent, t.bg, 20.dp) }
            Column(Modifier.weight(1f)) {
                T(heading, size = 16f, weight = Bold, letterSpacing = -0.1f)
                T(description, size = 13f, color = t.muted, modifier = Modifier.padding(top = 1.dp))
            }
        }
        if (notice != null) {
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(t.radius)).background(t.greenTint)
                    .tap({ ctl.markSeen(listOf(notice.id)); ctl.open(OpenOptions(requestId = notice.requestId)) })
                    .padding(vertical = 10.dp, horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                GreenDot()
                T(rich("You asked for " to false, notice.title to true, ". It's live." to false), size = 14f, lineHeight = 19f, modifier = Modifier.weight(1f))
                IconChevron(t.muted, 16.dp)
            }
        }
        val d = load.data
        if (d == null) {
            if (load.error == null) Skeleton(2)
        } else if (d.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                d.take(limit).forEach { r -> RequestRow(client, r, { ctl.open(OpenOptions(requestId = r.id)) }, compact = true) }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button("Suggest an idea", { ctl.open(OpenOptions(view = OpenView.New)) }, Modifier.weight(1f), small = true)
            if (d != null && d.size > limit) {
                Button("See all ${d.size}", { ctl.open(OpenOptions(view = OpenView.Board)) }, Modifier.weight(1f), small = true, ghost = true)
            }
        }
    }
}

public enum class RequestButtonVariant {
    /** Tinted pill with an icon and label. */
    Pill,

    /** Round icon button, e.g. in a header. */
    Icon,

    /** A settings-style row with a chevron. */
    Row,
}

/** A button for your own toolbar or menu. */
@Composable
public fun RequestButton(
    modifier: Modifier = Modifier,
    variant: RequestButtonVariant = RequestButtonVariant.Pill,
    label: String = "Request a feature",
    sublabel: String = "Vote on what we build next",
) {
    val ui = LocalUi.current ?: return
    if (ui.ctl.disabled) return
    val t = ui.theme
    val unseen = ui.ctl.unseenCount
    val open = { ui.ctl.open(OpenOptions()) }
    when (variant) {
        RequestButtonVariant.Icon -> Box(
            modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp).tap(open, label = label),
            contentAlignment = Alignment.Center,
        ) {
            Box(Modifier.size(40.dp).clip(CircleShape).background(t.surface), contentAlignment = Alignment.Center) { IconIdea(t.fg, t.bg, 22.dp) }
            if (unseen > 0) {
                Box(
                    Modifier.align(Alignment.TopEnd).padding(top = 8.dp, end = 8.dp).size(10.dp)
                        .background(androidx.compose.ui.graphics.Color(0xFFFF3B30), CircleShape).border(2.dp, t.bg, CircleShape),
                )
            }
        }
        RequestButtonVariant.Row -> Row(
            modifier.fillMaxWidth().clip(RoundedCornerShape(t.radius)).background(t.bg).tap(open, scale = false)
                .padding(vertical = 12.dp, horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(Modifier.size(32.dp).clip(RoundedCornerShape(11.dp)).background(t.tint), contentAlignment = Alignment.Center) { IconIdea(t.accent, t.bg, 18.dp) }
            Column(Modifier.weight(1f)) {
                T(label, size = 15.5f, weight = SemiBold)
                if (sublabel.isNotEmpty()) T(sublabel, size = 13f, color = t.muted)
            }
            if (unseen > 0) Badge(unseen)
            IconChevron(t.muted, 17.dp)
        }
        RequestButtonVariant.Pill -> Row(
            modifier.height(40.dp).clip(RoundedCornerShape(t.buttonRadius ?: 999.dp)).background(t.tint).tap(open)
                .padding(start = 13.dp, end = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            IconIdea(t.accent, t.bg, 18.dp)
            T(label, size = 14.5f, weight = Bold, color = t.accent)
            if (unseen > 0) Badge(unseen)
        }
    }
}

/**
 * A quiet line next to a feature: "Want more from charts?". Opens the composer already about that
 * topic, and the request is saved with it so you can see which feature people are asking about.
 */
@Composable
public fun AskAbout(topic: String, modifier: Modifier = Modifier, prompt: String? = null) {
    val ui = LocalUi.current ?: return
    if (ui.ctl.disabled) return
    val t = ui.theme
    Row(
        modifier.sizeIn(minHeight = 48.dp).tap({ ui.ctl.open(OpenOptions(view = OpenView.New, topic = topic)) }),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        IconIdea(t.accent, t.bg, 15.dp)
        T(prompt ?: "Want more from $topic?", size = 13.5f, color = t.muted)
    }
}

/**
 * For an empty search: "Can't find "export"? Ask for it". Opens the composer with the search as the
 * draft, tagged as a search so you can tell what people looked for and didn't find.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
public fun AskForIt(query: String, modifier: Modifier = Modifier) {
    val ui = LocalUi.current ?: return
    if (ui.ctl.disabled) return
    val t = ui.theme
    val q = query.trim()
    val shown = if (q.length > 40) q.take(39).trimEnd() + "…" else q
    FlowRow(
        modifier.tap({ ui.ctl.open(OpenOptions(view = OpenView.New, draft = q, topic = "search")) }).padding(vertical = 4.dp),
        verticalArrangement = Arrangement.Center,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) {
        T(if (shown.isNotEmpty()) "Can't find “$shown”?" else "Can't find it?", size = 14.5f, color = t.muted)
        Row(
            Modifier.clip(RoundedCornerShape(t.buttonRadius ?: 999.dp)).background(t.tint).padding(top = 3.dp, bottom = 3.dp, start = 12.dp, end = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            T("Ask for it", size = 14.5f, weight = Bold, color = t.accent)
            IconChevron(t.accent, 16.dp)
        }
    }
}

/** The whole experience inline, for a settings screen or a tab. Fills its parent unless you give it a height. */
@Composable
public fun FeatureBoard(modifier: Modifier = Modifier, startOnBoard: Boolean = false, height: Dp? = null) {
    val ui = LocalUi.current ?: return
    if (ui.ctl.disabled) return
    val t = ui.theme
    var route by remember { mutableStateOf<Route>(if (startOnBoard) Route.Board() else Route.Home()) }
    val shape = RoundedCornerShape(t.radius + 6.dp)
    Box(
        modifier.then(if (height != null) Modifier.height(height).fillMaxWidth() else Modifier.fillMaxSize())
            .clip(shape).background(t.bg).border(1.dp, t.border, shape),
    ) {
        Navigator(route, { route = it }, null)
    }
}
