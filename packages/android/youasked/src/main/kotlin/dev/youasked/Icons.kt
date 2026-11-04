package dev.youasked

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// Icons drawn on a canvas, so there are no vector assets and they look the same everywhere.
// Each is drawn on a 24-unit grid and scaled to `size`.

internal enum class Dir { Up, Down, Left, Right }

private fun DrawScope.chevron(color: Color, dir: Dir, strokeWidth: Float = 2.2f) {
    val u = size.minDimension / 24f
    val p = Path().apply {
        moveTo(9f * u, 5f * u); lineTo(16f * u, 12f * u); lineTo(9f * u, 19f * u)
    }
    val deg = when (dir) { Dir.Right -> 0f; Dir.Down -> 90f; Dir.Left -> 180f; Dir.Up -> 270f }
    rotate(deg) {
        drawPath(p, color, style = Stroke(strokeWidth * u, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

@Composable
internal fun IconChevron(color: Color, size: Dp = 18.dp, dir: Dir = Dir.Right, stroke: Float = 2.2f) {
    Canvas(Modifier.size(size)) { chevron(color, dir, stroke) }
}

@Composable
internal fun IconBack(color: Color, size: Dp = 20.dp) = IconChevron(color, size, Dir.Left)

@Composable
internal fun IconUp(color: Color, size: Dp = 16.dp) = IconChevron(color, size, Dir.Up, 2.8f)

@Composable
internal fun IconClose(color: Color, size: Dp = 18.dp) {
    Canvas(Modifier.size(size)) {
        val u = this.size.minDimension / 24f
        val st = Stroke(2.2f * u * 1.1f, cap = StrokeCap.Round)
        drawLine(color, Offset(6f * u, 6f * u), Offset(18f * u, 18f * u), st.width, StrokeCap.Round)
        drawLine(color, Offset(18f * u, 6f * u), Offset(6f * u, 18f * u), st.width, StrokeCap.Round)
    }
}

@Composable
internal fun IconPlus(color: Color, size: Dp = 18.dp) {
    Canvas(Modifier.size(size)) {
        val u = this.size.minDimension / 24f
        drawLine(color, Offset(12f * u, 5f * u), Offset(12f * u, 19f * u), 2.6f * u, StrokeCap.Round)
        drawLine(color, Offset(5f * u, 12f * u), Offset(19f * u, 12f * u), 2.6f * u, StrokeCap.Round)
    }
}

@Composable
internal fun IconCheck(color: Color, size: Dp = 13.dp) {
    Canvas(Modifier.size(size)) {
        val u = this.size.minDimension / 24f
        val p = Path().apply { moveTo(5f * u, 12.5f * u); lineTo(10f * u, 17.5f * u); lineTo(19f * u, 7f * u) }
        drawPath(p, color, style = Stroke(3f * u, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

/** An arrow pointing up, for send. */
@Composable
internal fun IconSend(color: Color, size: Dp = 18.dp) {
    Canvas(Modifier.size(size)) {
        val u = this.size.minDimension / 24f
        drawLine(color, Offset(12f * u, 20f * u), Offset(12f * u, 5f * u), 2.8f * u, StrokeCap.Round)
        val p = Path().apply { moveTo(5.5f * u, 11.5f * u); lineTo(12f * u, 5f * u); lineTo(18.5f * u, 11.5f * u) }
        drawPath(p, color, style = Stroke(2.8f * u, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

/** The ask mark: a speech bubble holding the vote arrow. [ink] colours the arrow. */
@Composable
internal fun IconIdea(color: Color, ink: Color, size: Dp = 22.dp) {
    Canvas(Modifier.size(size)) {
        val u = this.size.minDimension / 24f
        drawRoundRect(color, Offset(1.5f * u, 2.25f * u), Size(21f * u, 17.25f * u), CornerRadius(4.5f * u))
        val tail = Path().apply {
            moveTo(6f * u, 19f * u); lineTo(11.25f * u, 19f * u); lineTo(6f * u, 23.25f * u); close()
        }
        drawPath(tail, color)
        val arrow = Path().apply { moveTo(8.5f * u, 13.2f * u); lineTo(12f * u, 9.4f * u); lineTo(15.5f * u, 13.2f * u) }
        drawPath(arrow, ink, style = Stroke(2.5f * u, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

@Composable
internal fun IconChat(color: Color, size: Dp = 13.dp) {
    Canvas(Modifier.size(size)) {
        val u = this.size.minDimension / 13f
        drawRoundRect(color, Offset(1f * u, 1.6f * u), Size(11f * u, 8.4f * u), CornerRadius(2.8f * u), style = Stroke(1.5f * u))
        val tail = Path().apply { moveTo(3.2f * u, 9.6f * u); lineTo(3.2f * u, 12.2f * u); lineTo(6f * u, 9.8f * u); close() }
        drawPath(tail, color)
    }
}

@Composable
internal fun IconFrame(color: Color, size: Dp = 16.dp) {
    Canvas(Modifier.size(size)) {
        val u = this.size.minDimension / 16f
        drawRoundRect(
            color, Offset(1.8f * u, 1.8f * u), Size(12.4f * u, 12.4f * u), CornerRadius(3f * u),
            style = Stroke(1.8f * u, pathEffect = PathEffect.dashPathEffect(floatArrayOf(3f * u, 2.2f * u))),
        )
    }
}

@Composable
internal fun IconSpark(color: Color, size: Dp = 18.dp) {
    Canvas(Modifier.size(size)) {
        val u = this.size.minDimension / 18f
        val s = 9f * u
        val c = Offset(this.size.width / 2, this.size.height / 2)
        drawRoundRect(color, Offset(c.x - s / 2, c.y - s / 2), Size(s, s), CornerRadius(2f * u))
        rotate(45f, c) { drawRoundRect(color, Offset(c.x - s / 2, c.y - s / 2), Size(s, s), CornerRadius(2f * u)) }
    }
}
