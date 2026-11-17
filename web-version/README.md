# Mini Arcade Hub — Web, Desktop and Mobile

This folder contains the shared React/Vite application. The same game UI and game logic are used for GitHub Pages, Electron desktop builds, and Capacitor mobile builds.

## Requirements

- Node.js 22 or newer (Capacitor 8 requires Node.js 22+).
- npm.
- For Android: Android Studio and an Android SDK installation.
- For iOS: macOS with Xcode. iOS native builds cannot be produced on Windows.

## Web development

From this directory:

```sh
npm install
npm run dev
```

Run the tests and production web build:

```sh
npm test
npm run build
```

The normal web build uses the GitHub Pages base path `/KarlsGameHub/`.

## Desktop app with Electron

Start Vite and Electron together:

```sh
npm run desktop:dev
```

Build for the current computer:

```sh
npm run desktop:build
```

Build a Windows x64 NSIS installer locally:

```sh
npm run desktop:build:win
```

You can also build it in GitHub without setting up Electron Builder locally:

1. Open the repository's **Actions** tab.
2. Select **Build Mini Arcade Hub Windows installer**.
3. Choose **Run workflow** on the `main` branch.
4. When it completes, open the run and download the `Mini-Arcade-Hub-Windows-x64` artifact.

The GitHub artifact is temporary (14-day retention). Installers and desktop packages built locally are written to `release/`.

The Electron window uses context isolation, sandboxing, disabled Node integration, and web security. It does not expose Node APIs to the React page. External HTTPS links are opened in the operating system browser; non-HTTPS and file URLs are blocked.

Unsigned installers may show an operating-system publisher warning. Code signing is a separate release task.

## Android with Capacitor

Add the Android native project once:

```sh
npm run capacitor:add:android
```

Build the shared web app and copy it into the Android project:

```sh
npm run capacitor:sync
```

Open it in Android Studio:

```sh
npx cap open android
```

Then use Android Studio to run it on a device or emulator and create an APK/AAB release.

## iOS with Capacitor

On a Mac with Xcode installed, add the iOS project once:

```sh
npm run capacitor:add:ios
```

Then sync and open it:

```sh
npm run capacitor:sync
npx cap open ios
```

Use Xcode to run it on a simulator/device and prepare an iOS release.

## Supabase configuration

Open **Account** in the app and enter the existing Supabase Project URL and the project's **publishable key** (or its legacy anon key). The browser app rejects service-role and secret keys. Never put a service-role/secret key in this folder or any client app.

This project currently uses the existing username-only account format from the Python application. New accounts require the existing Supabase Auth email-confirmation setting to be disabled because the internal account address is not a deliverable email address. This username-only approach has no email-based password recovery.

## Current migration notes

- Number Hunt, Rock Paper Scissors, and Trivia are the playable non-wagering web games.
- Profiles, settings, and progress are currently saved locally and/or through the existing Supabase account.
- The online leaderboard is player-reported and is not a cheat-proof scoring service.
- Online prank effects use protected server RPCs.
- Wagering/betting games from the original desktop app are not part of this web/mobile build.
- The background music file is currently streamed from the public repository, so playback requires an internet connection. A later packaging pass can bundle this asset locally for fully offline playback.
- The Python desktop folder is intentionally left unchanged.

## Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite web development server |
| `npm test` | Run automated game/profile/security-helper tests |
| `npm run build` | Build GitHub Pages web version |
| `npm run build:native` | Build with root-relative asset paths |
| `npm run desktop:dev` | Run Electron with the Vite dev server |
| `npm run desktop:build:win` | Build Windows x64 NSIS installer |
| `npm run capacitor:add:android` | Generate Android project once |
| `npm run capacitor:add:ios` | Generate iOS project once |
| `npm run capacitor:sync` | Build and sync web assets into native projects |
