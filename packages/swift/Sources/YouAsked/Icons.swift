import SwiftUI

// Icons drawn as paths so they look the same at any size and in any colour, like the React Native package.

enum Dir { case up, down, left, right
    var angle: Angle {
        switch self { case .right: return .zero; case .down: return .degrees(90); case .left: return .degrees(180); case .up: return .degrees(270) }
    }
}

struct IconChevron: View {
    var color: Color
    var size: CGFloat = 18
    var dir: Dir = .right
    var stroke: CGFloat = 2.2
    var body: some View {
        Canvas { ctx, sz in
            let a = size * 0.297
            let c = CGPoint(x: sz.width / 2 - size * 0.07, y: sz.height / 2)
            var p = Path()
            p.move(to: CGPoint(x: c.x, y: c.y - a))
            p.addLine(to: CGPoint(x: c.x + a, y: c.y))
            p.addLine(to: CGPoint(x: c.x, y: c.y + a))
            let t = CGAffineTransform(translationX: sz.width / 2, y: sz.height / 2).rotated(by: CGFloat(dir.angle.radians)).translatedBy(x: -sz.width / 2, y: -sz.height / 2)
            ctx.stroke(p.applying(t), with: .color(color), style: StrokeStyle(lineWidth: stroke, lineCap: .round, lineJoin: .round))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

struct IconBack: View { var color: Color; var size: CGFloat = 20
    var body: some View { IconChevron(color: color, size: size, dir: .left) } }
struct IconUp: View { var color: Color; var size: CGFloat = 16
    var body: some View { IconChevron(color: color, size: size, dir: .up, stroke: 2.6) } }

struct IconClose: View {
    var color: Color
    var size: CGFloat = 18
    var body: some View {
        Canvas { ctx, sz in
            let l = size * 0.35
            let c = CGPoint(x: sz.width / 2, y: sz.height / 2)
            var p = Path()
            p.move(to: CGPoint(x: c.x - l * 0.72, y: c.y - l * 0.72)); p.addLine(to: CGPoint(x: c.x + l * 0.72, y: c.y + l * 0.72))
            p.move(to: CGPoint(x: c.x + l * 0.72, y: c.y - l * 0.72)); p.addLine(to: CGPoint(x: c.x - l * 0.72, y: c.y + l * 0.72))
            ctx.stroke(p, with: .color(color), style: StrokeStyle(lineWidth: 2.2, lineCap: .round))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

struct IconPlus: View {
    var color: Color
    var size: CGFloat = 18
    var body: some View {
        Canvas { ctx, sz in
            let l = size * 0.31
            let c = CGPoint(x: sz.width / 2, y: sz.height / 2)
            var p = Path()
            p.move(to: CGPoint(x: c.x - l, y: c.y)); p.addLine(to: CGPoint(x: c.x + l, y: c.y))
            p.move(to: CGPoint(x: c.x, y: c.y - l)); p.addLine(to: CGPoint(x: c.x, y: c.y + l))
            ctx.stroke(p, with: .color(color), style: StrokeStyle(lineWidth: 2.4, lineCap: .round))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

struct IconCheck: View {
    var color: Color
    var size: CGFloat = 13
    var body: some View {
        Canvas { ctx, sz in
            let s = size
            let o = CGPoint(x: (sz.width - s) / 2, y: (sz.height - s) / 2)
            var p = Path()
            p.move(to: CGPoint(x: o.x + s * 0.22, y: o.y + s * 0.52))
            p.addLine(to: CGPoint(x: o.x + s * 0.42, y: o.y + s * 0.70))
            p.addLine(to: CGPoint(x: o.x + s * 0.78, y: o.y + s * 0.30))
            ctx.stroke(p, with: .color(color), style: StrokeStyle(lineWidth: 2.4, lineCap: .round, lineJoin: .round))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

struct IconSend: View {
    var color: Color
    var size: CGFloat = 18
    var body: some View {
        Canvas { ctx, sz in
            let c = CGPoint(x: sz.width / 2, y: sz.height / 2 + size * 0.06)
            var p = Path()
            p.move(to: CGPoint(x: c.x, y: c.y + size * 0.31)); p.addLine(to: CGPoint(x: c.x, y: c.y - size * 0.28))
            let a = size * 0.24
            p.move(to: CGPoint(x: c.x - a, y: c.y - size * 0.28 + a)); p.addLine(to: CGPoint(x: c.x, y: c.y - size * 0.28)); p.addLine(to: CGPoint(x: c.x + a, y: c.y - size * 0.28 + a))
            ctx.stroke(p, with: .color(color), style: StrokeStyle(lineWidth: 2.4, lineCap: .round, lineJoin: .round))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// The ask mark: a speech bubble holding the vote arrow. `ink` colours the arrow.
struct IconIdea: View {
    var color: Color
    var size: CGFloat = 22
    var ink: Color = .white
    var body: some View {
        Canvas { ctx, sz in
            let u = size / 24
            let ox = (sz.width - size) / 2, oy = (sz.height - size) / 2
            func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: ox + x * u, y: oy + y * u) }
            ctx.fill(Path(roundedRect: CGRect(x: ox + 1.5 * u, y: oy + 2.25 * u, width: 21 * u, height: 17.25 * u), cornerRadius: 4.5 * u), with: .color(color))
            var tail = Path()
            tail.move(to: pt(6, 19.4)); tail.addLine(to: pt(11.25, 19.4)); tail.addLine(to: pt(6, 23.25)); tail.closeSubpath()
            ctx.fill(tail, with: .color(color))
            let a = size * 0.5 * 0.297 * 2 * 0.5
            let c = pt(12, 10.9)
            var arrow = Path()
            arrow.move(to: CGPoint(x: c.x - a, y: c.y + a * 0.55)); arrow.addLine(to: CGPoint(x: c.x, y: c.y - a * 0.45)); arrow.addLine(to: CGPoint(x: c.x + a, y: c.y + a * 0.55))
            ctx.stroke(arrow, with: .color(ink), style: StrokeStyle(lineWidth: max(2, 2.6 * u), lineCap: .round, lineJoin: .round))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

struct IconChat: View {
    var color: Color
    var size: CGFloat = 13
    var body: some View {
        Canvas { ctx, sz in
            let w = size * 0.86, h = size * 0.68
            let r = CGRect(x: (sz.width - w) / 2, y: (sz.height - h) / 2 - size * 0.04, width: w, height: h)
            ctx.stroke(Path(roundedRect: r, cornerRadius: size * 0.22), with: .color(color), lineWidth: 1.6)
            var tail = Path()
            tail.move(to: CGPoint(x: r.minX + size * 0.12, y: r.maxY - 1)); tail.addLine(to: CGPoint(x: r.minX + size * 0.12, y: r.maxY + size * 0.2)); tail.addLine(to: CGPoint(x: r.minX + size * 0.36, y: r.maxY - 1)); tail.closeSubpath()
            ctx.fill(tail, with: .color(color))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

struct IconFrame: View {
    var color: Color
    var size: CGFloat = 16
    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.2)
            .stroke(color, style: StrokeStyle(lineWidth: 1.8, dash: [3, 2]))
            .frame(width: size * 0.78, height: size * 0.78)
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

struct IconSpark: View {
    var color: Color
    var size: CGFloat = 18
    var body: some View {
        let s = size * 0.5
        ZStack {
            RoundedRectangle(cornerRadius: 2).fill(color).frame(width: s, height: s).rotationEffect(.degrees(45))
            RoundedRectangle(cornerRadius: 2).fill(color).frame(width: s, height: s)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
