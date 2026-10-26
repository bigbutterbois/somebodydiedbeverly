import SwiftUI

// The app's /enter page: the logo and one password field, checked by the site.
struct UnlockView: View {
    @Environment(Session.self) private var session
    @State private var password = ""
    @State private var checking = false
    @State private var error: String?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 32) {
            Monogram().frame(width: 96)

            VStack(spacing: 12) {
                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .multilineTextAlignment(.center)
                    .submitLabel(.go)
                    .focused($focused)
                    .onSubmit(submit)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .overlay(Capsule().stroke(Theme.accent))
                    .frame(maxWidth: 280)

                Group {
                    if checking {
                        Text("Checking…").foregroundStyle(Theme.muted)
                    } else if let error {
                        Text(error).foregroundStyle(Theme.danger)
                    } else {
                        Text(" ")
                    }
                }
                .font(.footnote)
                .multilineTextAlignment(.center)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
        .foregroundStyle(Theme.foreground)
        .onAppear { focused = true }
    }

    private func submit() {
        guard !password.isEmpty, !checking else { return }
        checking = true
        error = nil
        Task {
            do {
                try await session.unlock(password: password)
            } catch {
                self.error = error.localizedDescription
            }
            checking = false
        }
    }
}

#Preview {
    UnlockView().environment(Session())
}
