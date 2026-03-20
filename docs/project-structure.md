# Project Structure

This project uses Expo Router (file-based routing) and a small set of well-separated layers:

- `src/app/`: route entry points (screens) + root layout
- `src/components/`: reusable UI components (buttons, inputs, markdown renderer, etc.)
- `src/ctx/`: app-wide React context (authentication/session, theme preference)
- `src/services/`: network + streaming logic for AI
- `src/utils/`: helpers (storage key builders, env defaults, personalization, error mapping)
- `src/hooks/`: small state/hooks wrappers (theme + storage)

## Routing (`src/app/`)

Key files:
- `src/app/_layout.tsx`: root layout; applies theme, splash/toast, session guards, and the global back header.
- `src/app/(tabs)/_layout.tsx`: tab navigator wrapper (`Chat`, `Settings`).
- `src/app/(tabs)/index.tsx`: chat (streaming, composer + model strip, scroll/catch-up, day sections, timestamps).
- `src/app/(tabs)/settings.tsx`: settings (Appearance, Profile, AI, sign out, etc.).

Auth/settings routes:
- `src/app/(auth)/sign-in.tsx`
- `src/app/(auth)/sign-up.tsx`
- `src/app/(auth)/forgot-password.tsx`
- `src/app/(auth)/settings-profile.tsx`
- `src/app/(auth)/settings-security.tsx`
- `src/app/(auth)/settings-ai.tsx`
- `src/app/(auth)/change-password.tsx`

## AI Streaming (`src/services/openrouter-chat.ts`)

`streamChatCompletion()` performs the OpenAI-compatible `chat.completions.create({ stream: true })` call and yields content token deltas to the UI.

## Storage + Keys (`src/hooks/use-storage-state.ts` + `src/utils/*storage*`)

The app abstracts:
- Native secure storage via `expo-secure-store`
- Web storage via `localStorage`

Storage key names are derived from:
- the current session/email
- a small set of fixed “global” keys for legacy migration.

## Theming

- `src/ctx/theme-preference-context.tsx` — persisted system/light/dark + `Appearance.setColorScheme`
- `src/hooks/use-native-theme-colors.ts` — semantic colors from Expo Router `Color` + `useColorScheme()`

See [`theming.md`](theming.md).

