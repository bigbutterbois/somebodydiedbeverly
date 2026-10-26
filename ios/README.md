# Wilfully iPhone app

A native SwiftUI app for the site, for the owner only. The website stays the
backend: the app signs in with the same email and password as `/login`
(through `/api/app/login`), keeps the Supabase tokens in the Keychain, and
sends the access token as a bearer header (see `src/proxy.ts`). Everything
under `/api/app/` is owner-only. No API keys live in the app.

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
- `API.swift` and `Session.swift` handle the site and the owner sign-in.
