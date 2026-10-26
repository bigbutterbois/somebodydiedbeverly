import SwiftUI

struct RootView: View {
    @Environment(Session.self) private var session

    var body: some View {
        Group {
            switch session.state {
            case .signedOut: SignInView()
            case .signedIn: MainTabs()
            }
        }
        .task { await session.verify() }
    }
}

// One tab per part of the site. Each fills in over the next phases.
struct MainTabs: View {
    var body: some View {
        TabView {
            ComingSoon(title: "Forecast", note: "The Senate and House odds come next.")
                .tabItem { Label("Forecast", systemImage: "chart.bar.xaxis") }
            ComingSoon(title: "Metro", note: "Arrivals and the live train map are on the way.")
                .tabItem { Label("Metro", systemImage: "tram.fill") }
            ComingSoon(title: "Plates", note: "Diplomat plate sightings are on the way.")
                .tabItem { Label("Plates", systemImage: "car.fill") }
            MoreView()
                .tabItem { Label("More", systemImage: "ellipsis") }
        }
    }
}

struct ComingSoon: View {
    let title: String
    let note: String

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Monogram().frame(width: 72)
                Text(note)
                    .foregroundStyle(Theme.muted)
                    .multilineTextAlignment(.center)
            }
            .padding(32)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.background)
            .navigationTitle(title)
        }
    }
}

struct MoreView: View {
    @Environment(Session.self) private var session

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label("Blog", systemImage: "text.alignleft")
                    Label("Gallery", systemImage: "photo.on.rectangle")
                } footer: {
                    Text("Coming in a later update.")
                }
                Section {
                    Button("Sign out", role: .destructive) { session.signOut() }
                } footer: {
                    Text(version)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("More")
        }
    }

    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        return "Version \(short) (\(build))"
    }
}

#Preview {
    MainTabs().environment(Session())
}
