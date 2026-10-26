import Foundation

// Talks to the website, which stays the app's backend: the WMATA key and the
// Supabase keys never leave the server. Requests carry the owner's Supabase
// access token as a bearer header (see src/proxy.ts and src/app/api/app/).
enum API {
    static let base = URL(string: "https://www.wilfullymisunderstand.com")!

    enum Failure: LocalizedError {
        /// The sign-in was refused: expired, or signed out elsewhere.
        case locked
        /// The site answered with an error message of its own.
        case message(String)
        case offline

        var errorDescription: String? {
            switch self {
            case .locked: "Sign in again."
            case .message(let text): text
            case .offline: "Can't reach the site. Check your connection and try again."
            }
        }
    }

    private struct ErrorBody: Decodable { let error: String }

    static func get<T: Decodable>(_ path: String, token: String?, as type: T.Type = T.self) async throws -> T {
        try await send(URLRequest(url: base.appending(path: path)), token: token)
    }

    static func post<T: Decodable>(_ path: String, json: [String: String], token: String?, as type: T.Type = T.self) async throws -> T {
        var request = URLRequest(url: base.appending(path: path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(json)
        return try await send(request, token: token)
    }

    private static func send<T: Decodable>(_ request: URLRequest, token: String?) async throws -> T {
        var request = request
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw Failure.offline
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
            if status == 401, token != nil { throw Failure.locked }
            throw Failure.message(message ?? "Something went wrong (\(status)).")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
