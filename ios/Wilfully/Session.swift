import Foundation
import Observation

// Whether this phone has the family password. The token is checked against the
// site on launch; if the site refuses it (the password changed), the app locks.
@MainActor @Observable
final class Session {
    enum State { case locked, unlocked }

    private static let tokenKey = "site-access"

    private(set) var state: State
    private(set) var token: String?

    init() {
        let saved = Keychain.read(Self.tokenKey)
        token = saved
        state = saved == nil ? .locked : .unlocked
    }

    /// Re-checks a saved token. Offline counts as still unlocked.
    func verify() async {
        guard let token else { return }
        struct Ok: Decodable { let ok: Bool }
        do {
            _ = try await API.get("api/app/me", token: token, as: Ok.self)
        } catch API.Failure.locked {
            lock()
        } catch {}
    }

    func unlock(password: String) async throws {
        struct Unlocked: Decodable { let token: String }
        let result = try await API.post("api/app/unlock", json: ["password": password], token: nil, as: Unlocked.self)
        Keychain.save(result.token, for: Self.tokenKey)
        token = result.token
        state = .unlocked
    }

    func lock() {
        Keychain.delete(Self.tokenKey)
        token = nil
        state = .locked
    }
}
