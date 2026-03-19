# Theming

The app uses Expo Router color semantics and React Native theme switching.

## Native theme colors

`src/hooks/use-native-theme-colors.ts` defines a small set of semantic colors:

- `background`, `surface`, `text`, `secondaryText`
- `primary`, `border`, `error`, `success`, `placeholder`

Colors are derived from Expo Router’s `Color` API and depend on:

- platform (iOS/Android)
- the current system color scheme (light/dark)

## Components re-render on theme changes

When a component uses these colors, it should call `useColorScheme()` (directly or indirectly).

In this codebase:

- screens and shared components call `useColorScheme()`
- `useNativeThemeColors()` calls it via `useColorScheme()` internally

## Markdown theming

The Markdown renderer uses these colors for:

- body text
- link color
- code fences and inline code styling

See `src/components/markdown-message.tsx`.

