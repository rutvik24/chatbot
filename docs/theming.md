# Theming

The app uses Expo Router color semantics, optional **user appearance override**, and React Native’s color scheme.

## User appearance (Settings)

**Settings → Appearance** offers:

- **System** — follow the device (`Appearance.setColorScheme(null)`)
- **Light** / **Dark** — lock the app (`Appearance.setColorScheme('light' | 'dark')`)

Implementation:

- `src/ctx/theme-preference-context.tsx` — `ThemePreferenceProvider` (wraps near root in `src/app/_layout.tsx`, outside `SessionProvider` so sign-in respects the choice)
- Preference is stored under `app_theme_preference_v1` via `useStorageState` (SecureStore / `localStorage`)
- `useThemePreference()` exposes `preference`, `setPreference`, and `resolvedColorScheme` (`light` | `dark`)

React Navigation’s `ThemeProvider` and `expo-status-bar` `StatusBar` use **`resolvedColorScheme`** from the same context.

## Native theme colors

`src/hooks/use-native-theme-colors.ts` defines semantic colors:

- `background`, `surface`, `text`, `secondaryText`
- `primary`, `border`, `error`, `success`, `placeholder`

Colors use Expo Router’s `Color` API on iOS/Android; **web** uses fallbacks keyed off `useColorScheme()` (which updates after `Appearance.setColorScheme`).

Components that use these colors should trigger re-renders on scheme changes — `useNativeThemeColors()` calls `useColorScheme()` internally.

## Markdown and chat bubbles

`src/components/markdown-message.tsx`:

- **`tone="default"`** — assistant (and general) markdown on neutral surfaces
- **`tone="onPrimary"`** — user messages on the primary-colored bubble (light text, adjusted code/link styles)

See `src/components/markdown-message.tsx`.

## Web starter components

`ThemedView` / `ThemedText` (under `src/components/`) use `src/hooks/use-theme.ts`, which keys off `useColorScheme()` — they follow the same appearance override once the provider has applied it.
