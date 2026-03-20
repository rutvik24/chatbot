# Project Structure

This project uses Expo Router (file-based routing) and a small set of well-separated layers:

- `src/app/`: route entry points (screens) + root layout
- `src/components/`: reusable UI components (buttons, inputs, markdown renderer, native tabs wrapper, **tab screen header**, drawer content, **`auth/`** shared auth form layout, etc.)
- `src/ctx/`: app-wide React context (authentication/session, theme preference, **chat actions** for drawer → new chat, **chat history** for drawer list + apply session)
- `src/services/`: network + streaming logic for AI; **encrypted local chat history** (`chat-history-storage.ts`)
- `src/types/`: shared TS types (e.g. chat history store shape)
- `src/utils/`: helpers (AI credentials storage, **`session-account-storage`** for per-user SecureStore key suffix, **`chat-launch-preference`** for Chat open behavior, env defaults, navigation theme, personalization, **`session-email`** for display labels, error mapping)
- `src/constants/`: small shared constants (e.g. theme preference helpers)
- `src/hooks/`: small state/hooks wrappers (theme + storage)

## Routing (`src/app/`)

Key files:

- `src/app/_layout.tsx`: root layout; `ThemePreferenceProvider` → `SessionProvider` → React Navigation `ThemeProvider` with `createAppNavigationTheme()` → **native** `Stack` (themed headers on auth/settings, `headerShown: false` on the main drawer group and for hidden routes). Splash, toast, status bar.
- `src/app/(main)/_layout.tsx`: **drawer** layout (`expo-router/drawer`) wrapping the tab group; custom drawer content (`src/components/main-drawer-content.tsx`) includes **New chat** and **History**; `ChatActionsProvider` + **`ChatHistoryProvider`** (`src/ctx/chat-history-context.tsx`) bridge drawer ↔ chat.
- `src/app/(main)/(tabs)/_layout.tsx`: tab navigator wrapper (`Chat`, `Settings`) via `NativeTabs` (`src/components/app-tabs.tsx`).
- `src/app/(main)/(tabs)/index.tsx`: chat (streaming, composer + model strip, scroll/catch-up, day sections, timestamps). Uses **`TabScreenHeader`** title **Chat** + drawer control.
- `src/app/(main)/(tabs)/settings.tsx`: settings (Appearance, Profile, AI, sign out, etc.). Uses **`TabScreenHeader`** title **Settings** + same drawer control.

Navigation-related components:

- `src/components/app-tabs.tsx` — `expo-router/unstable-native-tabs` (`NativeTabs`) tab bar labels/icons for Chat & Settings.
- `src/components/tab-screen-header.tsx` — shared top bar for tab roots: centered screen title + ☰ (`DrawerActions.openDrawer`).
- `src/components/main-drawer-content.tsx` — drawer body: **New chat** + navigation back to Chat tab.
- `src/ctx/chat-actions-context.tsx` — registers the chat screen’s reset handler; supports **pending** new chat when Chat isn’t mounted.

Auth/settings routes:

- `src/app/(auth)/sign-in.tsx`
- `src/app/(auth)/sign-up.tsx`
- `src/app/(auth)/forgot-password.tsx`
- `src/app/(auth)/settings-profile.tsx`
- `src/app/(auth)/settings-security.tsx`
- `src/app/(auth)/settings-ai.tsx`
- `src/app/(auth)/change-password.tsx`

## AI streaming (`src/services/openai-compatible-chat.ts`)

`streamChatCompletion()` performs the OpenAI-compatible `chat.completions.create({ stream: true })` call and yields content token deltas to the UI.

Supporting modules:

- `src/utils/ai-credentials-storage.ts` — per-account API key, base URL, model id (legacy SecureStore key ids kept for migration)
- `src/utils/ai-api-key-env.ts` — optional `EXPO_PUBLIC_*` API key fallbacks

## Navigation theme (`src/utils/navigation-theme.ts`)

`createAppNavigationTheme(resolvedScheme)` builds the React Navigation `Theme` (including `colors.card` / `text` / `primary`) so the **native stack header** matches app light/dark. **`materialAndroidUiColors(isDark)`** is shared with `useNativeThemeColors()` for consistent Android palettes (see [`theming.md`](theming.md)).

## Storage + Keys (`src/hooks/use-storage-state.ts` + `src/utils/*storage*`)

The app abstracts:

- Native secure storage via `expo-secure-store`
- Web storage via `localStorage`

Storage key names are derived from:

- the current session/email
- a small set of fixed “global” keys for legacy migration.

## Theming

- `src/constants/theme-preference.ts` — `resolveColorSchemeFromPreference`, storage helpers for Appearance
- `src/ctx/theme-preference-context.tsx` — persisted system/light/dark + `Appearance.setColorScheme` (`useLayoutEffect`; `'unspecified'` for system on Android)
- `src/hooks/use-native-theme-colors.ts` — semantic UI colors (iOS `Color.ios.*`, Android `materialAndroidUiColors`, web hex)
- `src/utils/navigation-theme.ts` — navigation `Theme` + Android palette helper

See [`theming.md`](theming.md).
