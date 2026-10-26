# Wilfully iPhone app

A native SwiftUI app for the site. The website stays the backend: the app signs
in with the family password at `/api/app/unlock`, keeps the token it gets back
in the Keychain, and sends it as a bearer header on every request (see
`src/proxy.ts`). No API keys live in the app.

## Run it on your iPhone (free Apple ID)

1. Open `ios/Wilfully.xcodeproj` in Xcode.
2. Click the blue **Wilfully** project at the top of the file list, pick the
   **Wilfully** target, open **Signing & Capabilities**, and set **Team** to your
   Personal Team (add your Apple ID under Xcode, Settings, Accounts if it isn't
   listed).
3. Plug in the iPhone (first time only), pick it in the device menu at the top,
   and press Run (⌘R).
4. First time on the phone: Settings, General, VPN & Device Management, trust
   your developer certificate. Developer Mode must be on (Settings, Privacy &
   Security).

Builds signed with a free account stop opening after 7 days; press Run again to
refresh it.

## Layout

- `Wilfully/` is a synchronized folder: any file added there is part of the app,
  with no project-file edits.
- `Theme.swift` mirrors the site's colours in `src/app/globals.css`.
- `API.swift` and `Session.swift` handle the site and the password.
