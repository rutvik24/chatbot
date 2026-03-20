# Theming

The app uses Expo Router color semantics, optional **user appearance override**, and React Native’s color scheme.

## User appearance (Settings)

**Settings → Appearance** offers:

- **System** — follow the device (`Appearance.setColorScheme('unspecified')`; `null` crashes on Android)
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

**iOS** uses Expo Router’s `Color.ios.*`. **Android** uses a static Material-style palette from `materialAndroidUiColors()` keyed off `resolvedColorScheme` — `Color.android.dynamic.*` follows **device** night mode and ignores `Appearance.setColorScheme`, which made Light/Dark in Settings look reversed. **Web** uses hex fallbacks.

Components that use these colors should re-render when appearance changes — `useNativeThemeColors()` uses `useThemePreference().resolvedColorScheme` (and still subscribes via `useColorScheme()` for system mode).

## Markdown and chat bubbles

`src/components/markdown-message.tsx`:

- **`tone="default"`** — assistant (and general) markdown on neutral surfaces
- **`tone="onPrimary"`** — user messages on the primary-colored bubble (light text, adjusted code/link styles)

See `src/components/markdown-message.tsx`.

## Web starter components

`ThemedView` / `ThemedText` (under `src/components/`) use `src/hooks/use-theme.ts`, which keys off `useColorScheme()` — they follow the same appearance override once the provider has applied it.
