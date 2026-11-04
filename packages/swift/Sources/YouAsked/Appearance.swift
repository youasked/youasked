import SwiftUI
import UIKit

/// How YouAsked looks. Every field is optional; anything you leave out is derived from the accent,
/// background and foreground, and the text colour on the accent is picked for contrast.
/// Mirrors `Appearance` in the React Native package.
public struct Appearance {
    public enum Mode: Sendable { case auto, light, dark }

    /// Corner radius of buttons, the ask bar, the composer and chips, separately from cards.
    public enum ButtonRadius: ExpressibleByIntegerLiteral, ExpressibleByFloatLiteral, Equatable {
        case points(CGFloat)
        case pill
        public init(integerLiteral value: Int) { self = .points(CGFloat(value)) }
        public init(floatLiteral value: Double) { self = .points(CGFloat(value)) }
    }

    /// `.auto` follows the phone's light or dark setting.
    public var mode: Mode
    /// Brand colour for buttons, votes and links.
    public var accent: Color?
    public var accentForeground: Color?
    public var background: Color?
    public var foreground: Color?
    public var muted: Color?
    public var surface: Color?
    public var border: Color?
    /// Corner radius of cards, rows and the sheet, in points.
    public var radius: CGFloat
    /// A number in points, or `.pill`. Leave it out and each control keeps its own shape.
    public var buttonRadius: ButtonRadius?
    /// A font family applied to every piece of text, e.g. "Inter-SemiBold". Nil is the system font.
    public var font: String?

    public init(mode: Mode = .auto, accent: Color? = nil, accentForeground: Color? = nil, background: Color? = nil,
                foreground: Color? = nil, muted: Color? = nil, surface: Color? = nil, border: Color? = nil,
                radius: CGFloat = 14, buttonRadius: ButtonRadius? = nil, font: String? = nil) {
        self.mode = mode; self.accent = accent; self.accentForeground = accentForeground; self.background = background
        self.foreground = foreground; self.muted = muted; self.surface = surface; self.border = border
        self.radius = radius; self.buttonRadius = buttonRadius; self.font = font
    }

    public static let `default` = Appearance()
}

public extension Color {
    /// `Color(css: "#2B4BEE")`, also `rgb(43, 75, 238)` and `hsl(230, 85%, 55%)`. Nil if it doesn't parse.
    init?(css: String) {
        guard let c = RGBA(css: css) else { return nil }
        self = c.color
    }
}

// MARK: - Colour maths (ported from theme.ts)

struct RGBA: Equatable {
    var r: Double, g: Double, b: Double, a: Double

    init(_ r: Double, _ g: Double, _ b: Double, _ a: Double = 1) { self.r = r; self.g = g; self.b = b; self.a = a }

    init(_ color: Color, scheme: UIUserInterfaceStyle = .light) {
        let ui = UIColor(color).resolvedColor(with: UITraitCollection(userInterfaceStyle: scheme))
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        if ui.getRed(&red, green: &green, blue: &blue, alpha: &alpha) {
            self.init(Double(red) * 255, Double(green) * 255, Double(blue) * 255, Double(alpha))
        } else {
            var white: CGFloat = 0
            ui.getWhite(&white, alpha: &alpha)
            self.init(Double(white) * 255, Double(white) * 255, Double(white) * 255, Double(alpha))
        }
    }

    init?(css input: String) {
        let v = input.trimmingCharacters(in: .whitespaces).lowercased()
        switch v {
        case "white": self.init(255, 255, 255); return
        case "black": self.init(0, 0, 0); return
        case "transparent": self.init(0, 0, 0, 0); return
        default: break
        }
        if v.hasPrefix("#") {
            var h = String(v.dropFirst())
            guard h.allSatisfy({ $0.isHexDigit }) else { return nil }
            if h.count == 3 || h.count == 4 { h = h.map { "\($0)\($0)" }.joined() }
            guard h.count == 6 || h.count == 8 else { return nil }
            func n(_ i: Int) -> Double {
                let s = h.index(h.startIndex, offsetBy: i)
                return Double(Int(h[s..<h.index(s, offsetBy: 2)], radix: 16) ?? 0)
            }
            self.init(n(0), n(2), n(4), h.count == 8 ? n(6) / 255 : 1)
            return
        }
        let numbers = v.split(whereSeparator: { "(), /".contains($0) }).dropFirst().compactMap { Double($0.replacingOccurrences(of: "%", with: "").replacingOccurrences(of: "deg", with: "")) }
        if v.hasPrefix("rgb"), numbers.count >= 3 {
            self.init(numbers[0], numbers[1], numbers[2], numbers.count > 3 ? numbers[3] : 1)
        } else if v.hasPrefix("hsl"), numbers.count >= 3 {
            let h = (numbers[0].truncatingRemainder(dividingBy: 360)) / 360
            let s = numbers[1] / 100, l = numbers[2] / 100
            let q = l < 0.5 ? l * (1 + s) : l + s - l * s
            let p = 2 * l - q
            func f(_ t0: Double) -> Double {
                var t = t0.truncatingRemainder(dividingBy: 1)
                if t < 0 { t += 1 }
                let x = t < 1.0 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2.0 / 3 ? p + (q - p) * (2.0 / 3 - t) * 6 : p
                return (255 * x).rounded()
            }
            self.init(f(h + 1.0 / 3), f(h), f(h - 1.0 / 3), numbers.count > 3 ? numbers[3] : 1)
        } else {
            return nil
        }
    }

    var color: Color { Color(.sRGB, red: r / 255, green: g / 255, blue: b / 255, opacity: a) }

    /// `amount` of self over `other`, like CSS color-mix(in srgb, self amount, other).
    func mixed(with other: RGBA, _ amount: Double) -> RGBA {
        RGBA(r * amount + other.r * (1 - amount), g * amount + other.g * (1 - amount), b * amount + other.b * (1 - amount), a * amount + other.a * (1 - amount))
    }

    func withAlpha(_ amount: Double) -> RGBA { RGBA(r, g, b, a * amount) }

    var luminance: Double {
        func lin(_ v: Double) -> Double { let s = v / 255; return s <= 0.03928 ? s / 12.92 : pow((s + 0.055) / 1.055, 2.4) }
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    }
}

// MARK: - Resolved theme

struct Theme {
    var dark: Bool
    var accent: Color, accentFg: Color, bg: Color, fg: Color, muted: Color, surface: Color, border: Color, tint: Color
    var green: Color, greenTint: Color, amber: Color, amberTint: Color, red: Color, redTint: Color
    // Derived mixes that the styles use in several places.
    var newsDivider: Color, switchTrack: Color, composerFocus: Color, shippedDot: Color, grab: Color
    var radius: CGFloat
    /// Nil means each control keeps its own shape.
    var buttonRadius: CGFloat?
    var fontName: String?

    static let lightDefaults = (accent: RGBA(css: "#2B4BEE")!, bg: RGBA(css: "#ffffff")!, fg: RGBA(css: "#141B2D")!)
    static let darkDefaults = (accent: RGBA(css: "#7d93ff")!, bg: RGBA(css: "#161d31")!, fg: RGBA(css: "#F4F6FA")!)

    /// `scheme` is the phone's current setting; it only matters when `appearance.mode` is `.auto`.
    static func resolve(_ a: Appearance, scheme: ColorScheme) -> Theme {
        let dark: Bool
        switch a.mode {
        case .dark: dark = true
        case .light: dark = false
        case .auto: dark = scheme == .dark
        }
        let d = dark ? darkDefaults : lightDefaults
        let style: UIUserInterfaceStyle = dark ? .dark : .light
        func pick(_ c: Color?, _ fallback: RGBA) -> RGBA { c.map { RGBA($0, scheme: style) } ?? fallback }
        let accent = pick(a.accent, d.accent)
        let bg = pick(a.background, d.bg)
        let fg = pick(a.foreground, d.fg)
        let lum = accent.luminance
        let accentFg = a.accentForeground.map { RGBA($0, scheme: style) }
            ?? (1.05 / (lum + 0.05) >= (lum + 0.05) / 0.056 ? RGBA(255, 255, 255) : RGBA(css: "#0d1220")!)
        let green = RGBA(css: dark ? "#3fd07f" : "#16a34a")!
        let amber = RGBA(css: dark ? "#f2a93b" : "#c26a04")!
        let red = RGBA(css: "#e5484d")!
        let surface = a.surface.map { RGBA($0, scheme: style) } ?? fg.mixed(with: bg, 0.05)
        var br: CGFloat?
        switch a.buttonRadius {
        case .pill?: br = 999
        case .points(let p)?: br = p
        case nil: br = nil
        }
        return Theme(
            dark: dark,
            accent: accent.color, accentFg: accentFg.color, bg: bg.color, fg: fg.color,
            muted: (a.muted.map { RGBA($0, scheme: style) } ?? fg.mixed(with: bg, 0.58)).color,
            surface: surface.color,
            border: (a.border.map { RGBA($0, scheme: style) } ?? fg.mixed(with: bg, 0.11)).color,
            tint: accent.withAlpha(0.12).color,
            green: green.color, greenTint: green.mixed(with: bg, 0.14).color,
            amber: amber.color, amberTint: amber.withAlpha(0.16).color,
            red: red.color, redTint: red.mixed(with: bg, 0.12).color,
            newsDivider: fg.mixed(with: surface, 0.18).color,
            switchTrack: fg.mixed(with: bg, 0.18).color,
            composerFocus: accent.mixed(with: surface, 0.55).color,
            shippedDot: green.mixed(with: bg, 0.16).color,
            grab: fg.mixed(with: bg, 0.2).color,
            radius: a.radius, buttonRadius: br, fontName: a.font
        )
    }
}

private struct ThemeKey: EnvironmentKey { static let defaultValue = Theme.resolve(.default, scheme: .light) }

extension EnvironmentValues {
    var yaTheme: Theme {
        get { self[ThemeKey.self] }
        set { self[ThemeKey.self] = newValue }
    }
}
