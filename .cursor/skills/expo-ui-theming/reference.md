# Expo UI and Color API Reference

## Color (expo-router)

Import: `import { Color } from 'expo-router';`

### iOS — Color.ios.*

Semantic colors that follow system light/dark and accessibility:

- **Backgrounds:** `systemBackground`, `secondarySystemBackground`, `tertiarySystemBackground`
- **Labels:** `label`, `secondaryLabel`, `tertiaryLabel`, `quaternaryLabel`
- **Fills:** `fill`, `secondaryFill`, `tertiaryFill`
- **Other:** `separator`, `opaqueSeparator`, `link`, `placeholderText`
- **Standard:** `systemRed`, `systemBlue`, `systemGreen`, etc.

Maps to [UIKit standard and UI element colors](https://developer.apple.com/documentation/uikit/standard-colors).

### Android — Color.android.*

**Base:** `black`, `white`, `transparent`, `background_dark`, `background_light`

**Theme attributes (current theme):** `Color.android.attr.colorPrimary`, `colorSecondary`, `colorAccent`, `colorBackground`, etc.

**Material 3 static (light/dark roles):**

- Primary: `material.primary`, `material.onPrimary`, `material.primaryContainer`, `material.onPrimaryContainer`
- Surface: `material.surface`, `material.onSurface`, `material.surfaceVariant`, `material.onSurfaceVariant`
- Outline: `material.outline`, `material.outlineVariant`
- Error: `material.error`, `material.onError`
- And other M3 roles; see [Material Design 3 color roles](https://m3.material.io/styles/color/roles).

**Material 3 dynamic (wallpaper-based, Android 12+):** Same names under `Color.android.dynamic.*` (e.g. `dynamic.surface`, `dynamic.onSurface`). Always use `useColorScheme()` in the component so UI updates when theme changes.

### Web / default

`Color` has no web namespace. Use `Platform.select({ ..., default: yourFallback })` with your app’s theme (e.g. `Colors[colorScheme].background`) for web and any non-iOS/Android platform.

---

## Expo Components Quick Reference

| Package | Typical imports | Purpose |
|--------|------------------|--------|
| expo-router | `Link`, `Href`, `router`, `Stack`, `Tabs` | Navigation, file-based routing |
| expo-router/ui | `Tabs`, tab UI components | Tab bar and tab UI |
| expo-router/unstable-native-tabs | `NativeTabs` | Native tab implementations |
| expo-image | `Image` | Optimized images (caching, priority) |
| expo-symbols | `SymbolView` | SF Symbol icons (iOS) |
| expo-status-bar | `StatusBar` | Status bar style |
| expo-system-ui | — | System UI (e.g. Android theme) |
| expo-splash-screen | — | Splash screen control |
| expo-web-browser | `openBrowserAsync` | In-app browser |
| expo-device | `Device.*` | Device info |

Use these in preference to raw React Native or third-party equivalents when they cover the use case.
