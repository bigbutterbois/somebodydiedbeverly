import Foundation
import Observation

// The owner's sign-in. The app is for Mike only: it signs in with the same
// email and password as /login on the website, and keeps the Supabase tokens
// in the Keychain. The access token lasts an hour; when the site refuses it,
// the refresh token gets a new one, and if that fails too the app signs out.
@MainActor @Observable
final class Session {
    enum State { case signedOut, signedIn }

    private struct Tokens: Codable {
        let access_token: String
        let refresh_token: String
    }

    private static let tokensKey = "owner-session"

    private(set) var state: State
    private var tokens: Tokens?

    init() {
        let saved = Keychain.read(Self.tokensKey)
            .flatMap { try? JSONDecoder().decode(Tokens.self, from: Data($0.utf8)) }
        tokens = saved
        state = saved == nil ? .signedOut : .signedIn
    }

    /// A GET to the site as the owner, refreshing the sign-in once if needed.
    func get<T: Decodable>(_ path: String, as type: T.Type = T.self) async throws -> T {
        guard let tokens else { throw API.Failure.locked }
        do {
            return try await API.get(path, token: tokens.access_token, as: T.self)
        } catch API.Failure.locked {
            try await refresh()
            return try await API.get(path, token: self.tokens?.access_token, as: T.self)
        }
    }

    /// Re-checks the saved sign-in on launch. Offline counts as still signed in.
    func verify() async {
        struct Ok: Decodable { let ok: Bool }
        do {
            _ = try await get("api/app/me", as: Ok.self)
        } catch API.Failure.locked {
            signOut()
        } catch {}
    }

    func signIn(email: String, password: String) async throws {
        let result = try await API.post(
            "api/app/login", json: ["email": email, "password": password], token: nil, as: Tokens.self)
        save(result)
    }

    func signOut() {
        Keychain.delete(Self.tokensKey)
        tokens = nil
        state = .signedOut
    }

    private func refresh() async throws {
        guard let refreshToken = tokens?.refresh_token else { throw API.Failure.locked }
        do {
            let result = try await API.post(
                "api/app/refresh", json: ["refresh_token": refreshToken], token: nil, as: Tokens.self)
            save(result)
        } catch API.Failure.message, API.Failure.locked {
            signOut()
            throw API.Failure.locked
        }
    }

    private func save(_ new: Tokens) {
        if let data = try? JSONEncoder().encode(new) {
            Keychain.save(String(decoding: data, as: UTF8.self), for: Self.tokensKey)
        }
        tokens = new
        state = .signedIn
    }
}
