# Theming

The app combines a **user appearance override**, React Navigation theme, and semantic colors for screens and components.

## User appearance (Settings)

**Settings → Appearance** offers:

- **System** — follow the device: `Appearance.setColorScheme('unspecified')`. (**Do not** pass `null` on Android — `AppearanceModule.setColorScheme` requires a non-null style and will crash.)
- **Light** / **Dark** — lock the app: `Appearance.setColorScheme('light' | 'dark')`

Implementation:

- `src/ctx/theme-preference-context.tsx` — `ThemePreferenceProvider` (wraps near root in `src/app/_layout.tsx`, **outside** `SessionProvider` so sign-in respects the choice)
- Preference is applied in **`useLayoutEffect`** (before paint) to reduce header/body mismatch on first frame.
- Preference is stored under `app_theme_preference_v1` via `useStorageState` (SecureStore / `localStorage`)
- `useThemePreference()` exposes `preference`, `setPreference`, `resolvedColorScheme` (`light` | `dark`), `isPreferenceReady`

**Resolved scheme** comes from `resolveColorSchemeFromPreference()` in `src/constants/theme-preference.ts`:

- If the user chose **Light** or **Dark**, that wins (stays aligned with `Appearance.setColorScheme` even if `useColorScheme()` is briefly out of sync).
- If **System**, uses `useColorScheme()` from the hook, then falls back to `Appearance.getColorScheme()` when the hook reports `unspecified` / null-ish.

React Navigation’s `ThemeProvider` and `expo-status-bar` `StatusBar` use **`resolvedColorScheme`** from the same context.

## Native theme colors

`src/hooks/use-native-theme-colors.ts` defines semantic colors:

- `background`, `surface`, `text`, `secondaryText`
- `primary`, `border`, `error`, `success`, `placeholder`

**iOS** — Expo Router `Color.ios.*` (system dynamic colors follow `Appearance`).

**Android** — `materialAndroidUiColors(isDark)` from `src/utils/navigation-theme.ts`, keyed off **`resolvedColorScheme`**. The app does **not** use `Color.android.dynamic.*` for this chrome: those tokens track **device** night mode and ignore `Appearance.setColorScheme`, which made Light/Dark in Settings look inverted.

**Web** — hex fallbacks keyed off `resolvedColorScheme`.

Components should re-render when appearance changes — `useNativeThemeColors()` depends on `useThemePreference().resolvedColorScheme` and still calls `useColorScheme()` so **System** mode updates when the OS toggles.

## Navigation header colors

`src/app/_layout.tsx` passes `createAppNavigationTheme(resolvedColorScheme)` into `ThemeProvider` and uses **functional** `screenOptions={({ theme }) => ({ … })}` so native stack headers use the same `theme.colors` as the rest of the app. See [`project-structure.md`](project-structure.md).

Signed-in **Chat** and **Settings** tabs use **`headerShown: false`** on the drawer/tabs shell; their top bars are **`TabScreenHeader`** (`src/components/tab-screen-header.tsx`), themed with **`useNativeThemeColors()`** (background, hairline border, title and icon tint) so they match stack-auth screens and the chat body.

## Markdown and chat bubbles

`src/components/markdown-message.tsx`:

- **`tone="default"`** — assistant (and general) markdown on neutral surfaces
- **`tone="onPrimary"`** — user messages on the primary-colored bubble (light text, adjusted code/link styles)

See `src/components/markdown-message.tsx`.

## Web starter components

`ThemedView` / `ThemedText` (under `src/components/`) use `src/hooks/use-theme.ts`, which keys off `useColorScheme()` — they follow the same appearance override once the provider has applied it.
