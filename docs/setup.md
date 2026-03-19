# Setup & Running

## Requirements

- Bun
- Node.js (Expo toolchain dependency)
- An Expo-compatible runtime for your target:
  - iOS simulator / Xcode
  - Android emulator / Android Studio
  - Expo Go (optional for quick checks)

## Install

```bash
bun install
```

## Configure AI keys (recommended)

The app can use:
- A saved API key from **Settings → AI settings**, or
- An Expo public env var at build time.

For local development, set one of:
- `EXPO_PUBLIC_OPENROUTER_API_KEY`
- `EXPO_PUBLIC_OPENAI_API_KEY`

Example `.env.local`:

```bash
EXPO_PUBLIC_OPENROUTER_API_KEY="sk-..."
```

Note: Expo `EXPO_PUBLIC_*` values are embedded into the bundle. Do not use production secrets this way.

## Run

```bash
bun run start
```

Or target-specific:

```bash
bun run android
bun run ios
bun run web
```

## Lint

```bash
bun run lint
```

## Reset project (template helper)

If you need to clear starter screens:

```bash
bun run reset-project
```

