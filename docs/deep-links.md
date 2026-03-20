# Chat deep links

Share from **Chat** (header → share) produces a URL that includes the **thread id**. Opening it loads that conversation **from this device’s encrypted history** for the signed-in account (same email / account suffix).

---

## Release vs development — which URL?

| Environment | Link type | Use `exp://`? |
|-------------|-----------|----------------|
| **Release builds** (App Store, Play Store, TestFlight, EAS production/preview APK/IPA, `expo run:ios` / `expo run:android` **without** Expo Go) | **Real app link:** `chatapp://chat/<sessionId>` | **No.** Never ship or document `exp://` for end users. |
| **Expo Go** + Metro (local development only) | `exp://<host>:<port>/--/chat/<sessionId>` | **Yes** — only here, only while Metro is running. |

The app scheme **`chatapp`** comes from `scheme` in `app.json`.

**Implementation** (`src/utils/chat-share-link.ts`): **`buildChatDeepLink`** uses **`Linking.createURL` only in Expo Go** (`Constants.appOwnership === 'expo'`), which yields `exp://…/--/chat/<id>` for local dev. **Development clients** (`expo run:ios` / `expo run:android`) and **release** builds use an explicit **`chatapp://chat/<id>`** so Android matches iOS (Android was previously generating `exp://` in more cases because `createURL` followed the dev server).

---

## Release builds: real links (`chatapp://`)

### What users get

When someone taps **Share** on the Chat screen in a **release** (or **development client**) build, the message contains a URL like:

```text
chatapp://chat/1773997746072-c8284159a20b8
```

That is the correct format for production. Recipients open it like any app link:

- **iOS:** tap in Messages, Notes, Mail, etc. — iOS hands the URL to your app if it’s installed.
- **Android:** same; the intent filter for `chatapp` opens your app.

No `exp://` hostname and **no Metro** — the link works offline from the user’s perspective (the app still needs to load data from local history after launch).

### Test a release-style link locally

**iOS Simulator** (app installed with `bun run ios` / EAS build, **not** Expo Go):

```bash
xcrun simctl open booted "chatapp://chat/<SESSION_ID>"
```

**Android** (emulator or device, your package must handle the view intent):

```bash
adb shell am start -a android.intent.action.VIEW -d "chatapp://chat/<SESSION_ID>"
```

Replace `<SESSION_ID>` with an id from **Share** on a device/simulator, or from **History** / persisted store (same string as in `chatapp://chat/…`).

### Optional: HTTPS “universal” / App Links (not configured by default)

To open **`https://yourdomain.com/chat/<id>`** in the app (better for SMS and SEO), you must add **Associated Domains** (iOS) and **App Links** (Android) in your Expo config and host the **apple-app-site-association** / **assetlinks** files. See [Expo linking](https://docs.expo.dev/guides/linking/). Until then, **`chatapp://`** is the supported **real** link for release.

---

## Expo Go only (development — not for release)

Use this **only** when testing with **Expo Go** and a running Metro bundler. **Do not** use these URLs in release notes, marketing, or App Store metadata.

### Open from the terminal (iOS Simulator + Expo Go)

1. Start Metro: `bun run start`
2. Note the **port** (often **8081**).

```bash
bunx uri-scheme open "exp://127.0.0.1:8081/--/chat/<SESSION_ID>" --ios
```

Example:

```bash
bunx uri-scheme open "exp://127.0.0.1:8081/--/chat/1773997746072-c8284159a20b8" --ios
```

**Android emulator** (Expo Go + Metro on host):

```bash
bunx uri-scheme open "exp://10.0.2.2:8081/--/chat/<SESSION_ID>" --android
```

The `/--/` segment is required for **Expo Go** routing to `app/chat/[sessionId].tsx`.

### Convert a copied `chatapp://` link to `exp://` (Expo Go only)

If you copied a **release-style** share URL and need to test in **Expo Go**:

1. Take the **session id** after `chat/` (e.g. `1773997746072-c8284159a20b8`).
2. Build: `exp://127.0.0.1:<PORT>/--/chat/<SESSION_ID>` (use your Metro port).
3. Run `bunx uri-scheme open "…" --ios` (or `--android` as above).

This conversion is **only** for local Expo Go debugging — **not** for store builds.

---

## Quick reference

| Goal | Command / URL |
|------|----------------|
| Share in **release** | Use the in-app Share sheet → `chatapp://chat/<id>` |
| Open **release** link in Simulator | `xcrun simctl open booted "chatapp://chat/<id>"` |
| Open **release** link on Android | `adb shell am start -a android.intent.action.VIEW -d "chatapp://chat/<id>"` |
| Test route in **Expo Go** | `bunx uri-scheme open "exp://127.0.0.1:8081/--/chat/<id>" --ios` |

---

## Related code

- Route: `src/app/chat/[sessionId].tsx`
- Share URL helper: `src/utils/chat-share-link.ts` (`buildChatDeepLink` — uses your app `scheme`, so **release = `chatapp://`**, not `exp://`)
- Post–sign-in pending id: `src/utils/chat-deeplink-pending.ts`
