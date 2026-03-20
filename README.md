# Chat App

Expo Router chat app with per-user **OpenAI-compatible** AI streaming (any gateway that exposes the chat completions API).

## Docs Navigation

- [Overview (this README)](#chat-app)
- [`docs/README.md`](docs/README.md)
- [`docs/setup.md`](docs/setup.md)
- [`docs/project-structure.md`](docs/project-structure.md)
- [`docs/current-progress.md`](docs/current-progress.md)
- [`docs/ai-integration.md`](docs/ai-integration.md)
- [`docs/auth.md`](docs/auth.md)
- [`docs/security-and-secrets.md`](docs/security-and-secrets.md)
- [`docs/theming.md`](docs/theming.md)

## Current Progress (Snapshot)

### Implemented

- **Authentication** — Sign in / sign up / change password via local demo storage (`src/ctx/auth-context.tsx`).
- **Profile** — Settings profile for AI personalization (`src/app/(auth)/settings-profile.tsx`).
- **AI settings** — Per-account OpenAI-compatible API key + base URL (`src/app/(auth)/settings-ai.tsx`); optional build-time env fallback (see `.env.example`).
- **Appearance** — Settings → **System / Light / Dark**; persisted on-device (`app_theme_preference_v1`). `ThemePreferenceProvider` applies `Appearance.setColorScheme` in `useLayoutEffect`: **`'unspecified'`** for system (Android rejects `null`), **`'light'`** / **`'dark'`** when locked. Resolved scheme uses `resolveColorSchemeFromPreference()` in `src/constants/theme-preference.ts` so explicit Light/Dark matches navigation + `useNativeThemeColors()` even if `useColorScheme()` lags.
- **Navigation chrome** — Auth and settings routes use the **native stack** header (themed `ThemeProvider` + `createAppNavigationTheme()` in `src/utils/navigation-theme.ts`, functional `screenOptions` reading `theme`). **Inline titles** only (`headerLargeTitleEnabled: false` — large titles hid titles with short/centered `ScrollView`s). **Sign in** has a header title and **`headerBackVisible: false`** (root of logged-out stack). Other auth screens use the normal back control.
- **Chat** (`src/app/(main)/(tabs)/index.tsx`):
  - **Streaming** replies via OpenAI-compatible APIs (`src/services/openai-compatible-chat.ts`).
  - **Composer** — Message field first, **model strip** below (sparkles + model id); modal model list with search (SDK `models.list`, ~2 min cache when reopening).
  - **Messages** — User vs assistant bubbles (markdown for both; user bubble uses `onPrimary` tone), **timestamps**, **day section** headers (Today / Yesterday / date).
  - **Scroll** — Auto-scroll only when you’re near the bottom; **Catch up / Latest** floating button when scrolled up; sticky follow after Catch up during streaming (instant `scrollToEnd` + layout passes).
  - **Stop** — Aborts the stream; if **no** assistant text arrived yet, the user+placeholder turn is **removed** and the prompt returns to the input; if **any** tokens arrived, partial reply **stays** and the input is not refilled.
  - **Drawer** — Logged-in shell uses `expo-router/drawer` around native tabs; **menu** (top-left) opens the drawer; **New chat** clears the in-memory thread and aborts any active stream.
- **Markdown** — Assistant (and user) content with themed code blocks + Copy (`src/components/markdown-message.tsx`).
- **Errors** — User-facing provider errors are sanitized (no env names, keys, or JSON dumps in chat); full detail in dev logs (`src/utils/provider-chat-error.ts`).
- **Theming** — `useNativeThemeColors()`: **iOS** uses Expo Router `Color.ios.*`; **Android** uses `materialAndroidUiColors()` (same file as nav theme) so UI follows **Settings → Appearance** instead of `Color.android.dynamic.*` (which follows device night mode only). **Web** uses hex fallbacks. See [`docs/theming.md`](docs/theming.md).

### Known limitations / next steps

- Auth is a **mock** (no real backend). Passwords and sessions are local.
- Forgot password is **mocked** (no email).
- **No** persisted conversation history (messages are in-memory on the chat screen).
- Default model id is `DEFAULT_CHAT_MODEL_ID` in `openai-compatible-chat.ts` (bundled default targets a common free-tier model id; pick another in Chat if your provider differs).

## Quick Start

1. Install deps

```bash
bun install
```

2. Start (use your preferred target)

```bash
bun run start
# or
bun run android
bun run ios
bun run web
```

3. Lint

```bash
bun run lint
```

## License

This project is licensed under the **private / proprietary** terms in the [`LICENSE`](LICENSE) file in the repository root (not MIT).
