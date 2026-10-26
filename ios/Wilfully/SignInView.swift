import SwiftUI

// The app's /login page: the logo, then the owner's email and password,
// checked by the site.
struct SignInView: View {
    @Environment(Session.self) private var session
    @State private var email = ""
    @State private var password = ""
    @State private var checking = false
    @State private var error: String?
    @FocusState private var field: Field?

    private enum Field { case email, password }

    var body: some View {
        VStack(spacing: 32) {
            Monogram().frame(width: 96)

            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textContentType(.username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.next)
                    .focused($field, equals: .email)
                    .onSubmit { field = .password }
                    .pill()

                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .submitLabel(.go)
                    .focused($field, equals: .password)
                    .onSubmit(submit)
                    .pill()

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
        .onAppear { field = .email }
    }

    private func submit() {
        guard !email.isEmpty, !password.isEmpty, !checking else { return }
        checking = true
        error = nil
        Task {
            do {
                try await session.signIn(email: email, password: password)
            } catch {
                self.error = error.localizedDescription
            }
            checking = false
        }
    }
}

private extension View {
    // The site's rounded teal-outlined input.
    func pill() -> some View {
        multilineTextAlignment(.center)
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .overlay(Capsule().stroke(Theme.accent))
            .frame(maxWidth: 280)
    }
}

#Preview {
    SignInView().environment(Session())
}
