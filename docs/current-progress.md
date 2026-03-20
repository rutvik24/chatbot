# Current Progress

This document matches the behavior in the repo today (chat, settings, AI, theming).

## Navigation & Screens

Expo Router **Stack** + **guards**:

- **Signed out:** `sign-in`, `sign-up`, `forgot-password`
- **Signed in:** tabs (**Chat**, **Settings**) and stack settings routes

Main routes:

| Route | Purpose |
|--------|---------|
| `/(tabs)/index` | Chat: streaming replies, composer, model picker strip, scroll / catch-up UX |
| `/(tabs)/settings` | Profile & AI links, **Appearance** (system / light / dark), sign out, error-boundary test |
| `/(auth)/settings-ai` | API key, base URL, model hint |
| `/(auth)/settings-profile` | Name fields for personalization system message |
| `/(auth)/settings-security` | Change password + sign out |
| `/(auth)/change-password` | Password change |

Root `src/app/_layout.tsx`: `ThemePreferenceProvider` → `SessionProvider` → navigation theme + `StatusBar` from resolved light/dark.

## Chat (`/(tabs)/index`)

- **Streaming** — OpenAI-compatible `stream: true`; tokens batched ~40ms before UI append for performance.
- **Stop** — `AbortController`; cancellation is not shown as an error in the bubble.
  - **No assistant output yet** — last user message + empty assistant row removed; same text restored to the composer (edit/resend).
  - **Any tokens received** — user + partial assistant messages kept; composer not refilled.
- **Model** — Modal list from `client.models.list()` when opened; selection stored per account; default model in `DEFAULT_CHAT_MODEL_ID` (`openai-compatible-chat.ts`).
- **Scroll** — `shouldAutoScrollRef` + **stick-to-bottom** after send or **Catch up**; `onContentSizeChange` + scheduled `scrollToEnd` while following; wider cancel threshold while generating so layout jitter doesn’t drop follow mode.
- **Catch up / Latest** — Floating button above the composer when not at bottom; **Catch up** variant while generating; docked with elevation so it stays visible on Android.
- **UI** — Day pills with calendar icon; message times; user primary bubble vs assistant surface bubble (shadows / elevation); unified composer card (outer shadow, inner clip).

## Prompt / history

- Last ~**10** user/assistant turns sent to the model.
- Optional **system** message from profile + session (`buildUserPersonalizationSystemMessage`).

## Authentication (demo / local)

- Credentials and sessions in local storage (`src/ctx/auth-context.tsx`).
- Forgot password **mocked** (no email).

## Settings & storage

- AI key + base URL + chat model id: **per account**, secure storage on native, `localStorage` on web.
- **Theme preference** (`system` / `light` / `dark`): device-local key `app_theme_preference_v1` (same storage abstraction; not a secret).
- Legacy global API key migration (see `security-and-secrets.md`).

## Known gaps

- No **server** auth or synced history.
- No **persistent** chat threads (reload loses in-memory messages).
- Forgot password and auth need a real backend for production.
