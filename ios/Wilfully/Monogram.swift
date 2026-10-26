import SwiftUI

// The site's logo (src/components/Monogram.tsx): a W and the same W turned
// upside down (the teal M) inside a ring, drawn on the website's 64-unit grid.
struct Monogram: View {
    var body: some View {
        Canvas { context, size in
            let scale = min(size.width, size.height) / 64
            context.scaleBy(x: scale, y: scale)

            let ring = Path(ellipseIn: CGRect(x: 3.5, y: 3.5, width: 57, height: 57))
            context.stroke(ring, with: .color(Theme.accent), lineWidth: 2.5)

            // The letters are cropped flat at the top and bottom.
            context.clip(to: Path(CGRect(x: 0, y: 21, width: 64, height: 22)))
            let style = StrokeStyle(lineWidth: 3.2, lineJoin: .miter, miterLimit: 10)
            context.stroke(
                letter([(9.53, 15.25), (17.73, 43), (21.57, 30), (25.41, 43), (33.61, 15.25)]),
                with: .color(Theme.foreground), style: style)
            context.stroke(
                letter([(54.47, 48.75), (46.27, 21), (42.43, 34), (38.59, 21), (30.39, 48.75)]),
                with: .color(Theme.accent), style: style)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityLabel("wilfullymisunderstand")
    }

    private func letter(_ points: [(CGFloat, CGFloat)]) -> Path {
        Path { path in
            path.addLines(points.map { CGPoint(x: $0.0, y: $0.1) })
        }
    }
}

#Preview {
    Monogram().frame(width: 120).padding().background(Theme.background)
}
