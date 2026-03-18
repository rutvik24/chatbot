---
name: expo-ui-theming
description: Build UI using Expo first-party components (expo-image, expo-symbols, expo-router/ui, etc.) and support dark/light themes with colors from Expo Router's Color API. Use when adding screens, components, or theming in an Expo Router app.
---

# Expo UI and Theming

## Principles

1. **Prefer Expo components** over raw React Native or third-party equivalents when available.
2. **Support dark and light theme**; never hardcode colors that ignore system appearance.
3. **Source theme colors** from Expo Router's `Color` API (and React Native's `useColorScheme`) so native light/dark behavior is consistent.

## Expo Components to Prefer

Use these instead of RN/third-party alternatives when they fit:

| Use case | Expo component | Avoid |
|----------|----------------|--------|
| Images | `expo-image` | `Image` from react-native |
| Icons (iOS SF Symbols) | `expo-symbols` (`SymbolView`) | Custom icon fonts where symbol exists |
| Navigation / tabs | `expo-router` + `expo-router/ui` (e.g. `Tabs`, `Link`) | Custom tab implementations |
| Status bar | `expo-status-bar` | — |
| Splash / system UI | `expo-splash-screen`, `expo-system-ui` | — |
| Links | `Link`, `Href` from `expo-router` | Manual linking |
| Browser | `expo-web-browser` | — |

For routing and layout, use Expo Router conventions (file-based routes, `_layout.tsx`, slots).

## Theming: Expo Router Color API

Import `Color` from `expo-router`. Use platform-specific namespaces so backgrounds and text follow system light/dark and (on Android) Material dynamic color when applicable.

### iOS

```tsx
import { Color } from 'expo-router';
import { View, Text, useColorScheme } from 'react-native';

function ThemedBox() {
  useColorScheme(); // Required so component re-renders when theme changes

  return (
    <View style={{ backgroundColor: Color.ios.systemBackground }}>
      <Text style={{ color: Color.ios.label }}>Hello</Text>
    </View>
  );
}
```

Common iOS semantic colors: `Color.ios.systemBackground`, `Color.ios.label`, `Color.ios.secondaryLabel`, `Color.ios.tertiaryLabel`, `Color.ios.separator`, `Color.ios.fill`.

### Android

Use **dynamic** colors when you want wallpaper-based theming and automatic light/dark:

```tsx
import { Color } from 'expo-router';
import { View, Text, useColorScheme } from 'react-native';

function ThemedBox() {
  useColorScheme(); // Required for theme change re-renders (especially with React Compiler)

  return (
    <View style={{ backgroundColor: Color.android.dynamic.surface }}>
      <Text style={{ color: Color.android.dynamic.onSurface }}>Hello</Text>
    </View>
  );
}
```

Use **static** Material 3 colors when you need fixed light/dark roles: `Color.android.material.surface`, `Color.android.material.onSurface`, `Color.android.material.primary`, etc.

### Cross-Platform and Web

`Color` is platform-specific (iOS/Android). For shared code and web fallback, use `Platform.select` and a fallback (e.g. custom theme or hex):

```tsx
import { Platform, View, Text, useColorScheme } from 'react-native';
import { Color } from 'expo-router';

function ThemedBox() {
  useColorScheme();

  const backgroundColor = Platform.select({
    ios: Color.ios.systemBackground,
    android: Color.android.dynamic.surface,
    default: '#ffffff', // e.g. web or custom theme
  });

  const textColor = Platform.select({
    ios: Color.ios.label,
    android: Color.android.dynamic.onSurface,
    default: '#000000',
  });

  return (
    <View style={{ backgroundColor }}>
      <Text style={{ color: textColor }}>Hello</Text>
    </View>
  );
}
```

If the project has a shared theme (e.g. `Colors.light` / `Colors.dark`), use that for `default` and drive it with `useColorScheme()` so web and other platforms stay in sync with light/dark.

## Required: useColorScheme() for Theme Updates

Always call `useColorScheme()` in any component that uses theme-dependent colors (including `Color.android.dynamic.*` or `Color.android.material.*`). Otherwise the component may not re-render when the user switches light/dark, especially with React Compiler.

```tsx
function Screen() {
  useColorScheme(); // Ensures re-render on theme change

  return (
    <View style={{ backgroundColor: Color.android.dynamic.surface }}>
      ...
    </View>
  );
}
```

## App Config

Ensure `app.json` / `app.config.*` has:

```json
"expo": {
  "userInterfaceStyle": "automatic"
}
```

Use `expo-system-ui` in the project so Android respects `userInterfaceStyle` (required for development builds).

## Summary Checklist

- [ ] Use Expo components (expo-image, expo-symbols, expo-router/ui, etc.) instead of RN/third-party where applicable.
- [ ] Use `Color` from `expo-router` for backgrounds and text (iOS: `Color.ios.*`, Android: `Color.android.dynamic.*` or `Color.android.material.*`).
- [ ] Call `useColorScheme()` in components that use theme-dependent colors.
- [ ] Use `Platform.select` with a `default` for web/cross-platform when using `Color`.
- [ ] Keep `userInterfaceStyle: "automatic"` and have `expo-system-ui` installed for Android.

For full Color API details and more semantic color names, see [reference.md](reference.md).
