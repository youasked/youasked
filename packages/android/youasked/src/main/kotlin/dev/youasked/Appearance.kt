package dev.youasked

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

public enum class YouAskedMode {
    /** Follows the phone's light or dark setting. */
    Auto,
    Light,
    Dark,
}

/** Corner radius of buttons, the ask bar, the composer and chips. */
@Immutable
public sealed class ButtonRadius {
    /** Fully round. */
    public data object Pill : ButtonRadius()

    public data class Of(val radius: Dp) : ButtonRadius()
}

/**
 * Colours, shape and font, matching the React Native `appearance` prop. Anything left at its default is
 * derived from the accent, background and foreground, and the text colour on the accent is picked for contrast.
 */
@Immutable
public data class YouAskedAppearance(
    val mode: YouAskedMode = YouAskedMode.Auto,
    /** Brand colour for buttons, votes and links. */
    val accent: Color = Color.Unspecified,
    val accentForeground: Color = Color.Unspecified,
    val background: Color = Color.Unspecified,
    val foreground: Color = Color.Unspecified,
    val muted: Color = Color.Unspecified,
    val surface: Color = Color.Unspecified,
    val border: Color = Color.Unspecified,
    /** Corner radius of cards, rows and the sheet. */
    val radius: Dp = 14.dp,
    /** Leave null and each control keeps its own shape. [ButtonRadius.Pill] makes them fully round. */
    val buttonRadius: ButtonRadius? = null,
    /** Applied to every piece of text. */
    val fontFamily: FontFamily? = null,
)

@Immutable
internal data class Theme(
    val dark: Boolean,
    val accent: Color,
    val accentFg: Color,
    val bg: Color,
    val fg: Color,
    val muted: Color,
    val surface: Color,
    val border: Color,
    val tint: Color,
    val green: Color,
    val greenTint: Color,
    val amber: Color,
    val amberTint: Color,
    val red: Color,
    val redTint: Color,
    val radius: Dp,
    /** Null means each control keeps its own shape. */
    val buttonRadius: Dp?,
    val fontFamily: FontFamily?,
)

/** `amount` of [a] over [b], like CSS color-mix(in srgb, a amount, b). */
internal fun mix(a: Color, b: Color, amount: Float): Color = Color(
    red = a.red * amount + b.red * (1 - amount),
    green = a.green * amount + b.green * (1 - amount),
    blue = a.blue * amount + b.blue * (1 - amount),
    alpha = a.alpha * amount + b.alpha * (1 - amount),
)

internal fun alpha(c: Color, amount: Float): Color = c.copy(alpha = c.alpha * amount)

private fun contrastRatio(a: Color, b: Color): Float {
    val l1 = a.luminance() + 0.05f
    val l2 = b.luminance() + 0.05f
    return if (l1 > l2) l1 / l2 else l2 / l1
}

private val Ink = Color(0xFF0D1220)

internal fun resolveTheme(a: YouAskedAppearance, systemDark: Boolean): Theme {
    val dark = when (a.mode) {
        YouAskedMode.Dark -> true
        YouAskedMode.Light -> false
        YouAskedMode.Auto -> systemDark
    }
    val accent = a.accent.takeIf { it.isSpecified() } ?: if (dark) Color(0xFF7D93FF) else Color(0xFF2B4BEE)
    val bg = (a.background.takeIf { it.isSpecified() } ?: if (dark) Color(0xFF161D31) else Color.White).let { it.compositeOver(Color.Black) }
    val fg = a.foreground.takeIf { it.isSpecified() } ?: if (dark) Color(0xFFF4F6FA) else Color(0xFF141B2D)
    val accentFg = a.accentForeground.takeIf { it.isSpecified() }
        ?: if (contrastRatio(accent, Color.White) >= contrastRatio(accent, Ink)) Color.White else Ink
    val green = if (dark) Color(0xFF3FD07F) else Color(0xFF16A34A)
    val amber = if (dark) Color(0xFFF2A93B) else Color(0xFFC26A04)
    val red = Color(0xFFE5484D)
    return Theme(
        dark = dark,
        accent = accent,
        accentFg = accentFg,
        bg = bg,
        fg = fg,
        muted = a.muted.takeIf { it.isSpecified() } ?: mix(fg, bg, 0.58f),
        surface = a.surface.takeIf { it.isSpecified() } ?: mix(fg, bg, 0.05f),
        border = a.border.takeIf { it.isSpecified() } ?: mix(fg, bg, 0.11f),
        tint = alpha(accent, 0.12f),
        green = green,
        greenTint = mix(green, bg, 0.14f),
        amber = amber,
        amberTint = alpha(amber, 0.16f),
        red = red,
        redTint = mix(red, bg, 0.12f),
        radius = a.radius,
        buttonRadius = when (val b = a.buttonRadius) {
            null -> null
            ButtonRadius.Pill -> 999.dp
            is ButtonRadius.Of -> b.radius
        },
        fontFamily = a.fontFamily,
    )
}

private fun Color.isSpecified() = this != Color.Unspecified

@Composable
internal fun rememberSystemDark(): Boolean = isSystemInDarkTheme()
