# Chat deep links

Share from **Chat** (header → share) produces a URL that includes the **thread id**. Opening it loads that conversation **from this device’s encrypted history** for the signed-in account (same email / account suffix).

## URL shapes

| Build | Example |
|--------|---------|
| **Dev / production** (your app binary) | `chatapp://chat/<sessionId>` — `chatapp` is the `scheme` in `app.json`. |
| **Expo Go** (Metro must be running) | `exp://<host>:<port>/--/chat/<sessionId>` |

---

## Expo Go: open from the terminal (iOS Simulator)

1. Start Metro: `bun run start`
2. Note the **port** in the terminal (often **8081**).
3. Put your **session id** into the URL below (see [Convert a copied link](#convert-a-copied-share-link-into-exp-format)).

```bash
bunx uri-scheme open "exp://127.0.0.1:8081/--/chat/<SESSION_ID>" --ios
```

**Concrete example** (simulator + Metro on the same Mac, default port):

```bash
bunx uri-scheme open "exp://127.0.0.1:8081/--/chat/1773997746072-c8284159a20b8" --ios
```

- Use **`127.0.0.1`** when the **iOS Simulator** runs on the **same machine** as Metro.
- **Physical iPhone** on Wi‑Fi: replace `127.0.0.1` with your computer’s **LAN IP** (shown in the Expo CLI / Dev Tools).

**Android emulator** (Metro on host; `10.0.2.2` = host loopback):

```bash
bunx uri-scheme open "exp://10.0.2.2:8081/--/chat/<SESSION_ID>" --android
```

The `/--/` segment is required for **Expo Go** so the path routes to your Expo Router screen `app/chat/[sessionId].tsx`.

---

## Convert a copied share link into `exp://` format

After **Share**, you might copy something like:

```text
Open this chat in the app (same account & device history):
chatapp://chat/1773997746072-c8284159a20b8
```

Or only the URL line:

```text
chatapp://chat/1773997746072-c8284159a20b8
```

Do this:

1. **Find the session id** — everything **after** `chat/` up to the next space, newline, or `?`.
   - Example: `chatapp://chat/1773997746072-c8284159a20b8` → id = `1773997746072-c8284159a20b8`
2. If the id was **percent-encoded** in the link, decode it (most ids are alphanumeric + `-` and need no change).
3. **Fill in the Expo Go template:**

   ```text
   exp://127.0.0.1:<PORT>/--/chat/<SESSION_ID>
   ```

   - **`<PORT>`** = Metro port from `bun run start` (default `8081`).
   - **`<SESSION_ID>`** = the id from step 1.

4. Run:

   ```bash
   bunx uri-scheme open "exp://127.0.0.1:8081/--/chat/1773997746072-c8284159a20b8" --ios
   ```

**Quick copy-paste pattern:** replace only the id (and port if needed):

```bash
bunx uri-scheme open "exp://127.0.0.1:8081/--/chat/PASTE_ID_HERE" --ios
```

---

## Dev / production build (custom scheme, no Expo Go)

**iOS Simulator:**

```bash
xcrun simctl open booted "chatapp://chat/<SESSION_ID>"
```

**Android:**

```bash
adb shell am start -a android.intent.action.VIEW -d "chatapp://chat/<SESSION_ID>"
```

Here you use the **same** `chatapp://…` URL as in the share sheet — no `exp://` conversion.

---

## Related code

- Route: `src/app/chat/[sessionId].tsx`
- Share URL helper: `src/utils/chat-share-link.ts` (`buildChatDeepLink`)
- Post–sign-in pending id: `src/utils/chat-deeplink-pending.ts`
