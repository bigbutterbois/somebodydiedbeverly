import SwiftUI
import UIKit

// The website's "gallery wall" colours (src/app/globals.css): dark by default,
// light when the phone is in light mode.
enum Theme {
    static let background = Color(light: 0xFAFAF8, dark: 0x121315)
    static let surface = Color(light: 0xEFEFEC, dark: 0x1A1C1F)
    static let foreground = Color(light: 0x1B1C1F, dark: 0xE9E7E3)
    static let muted = Color(light: 0x63666C, dark: 0x8E9196)
    static let line = Color(light: 0xDDDCD8, dark: 0x2A2D31)
    static let accent = Color(light: 0x0F7C73, dark: 0x3FBFB2)
    static let danger = Color(light: 0xC0392B, dark: 0xF07A6E)
}

extension Color {
    init(light: UInt32, dark: UInt32) {
        self.init(UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}
