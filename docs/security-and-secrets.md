# Security & Secrets

This project includes on-device secure storage for AI credentials, plus a demo-only auth model.

## AI credentials storage

OpenAI-compatible AI credentials are stored via:

- Native: `expo-secure-store`
- Web: `localStorage`

The storage keys are derived from the current user session/email, so each account can have different:

- OpenAI-compatible API key
- OpenAI-compatible base URL (endpoint/gateway)

See:

- `src/utils/ai-credentials-storage.ts`
- `src/hooks/use-storage-state.ts`

## Legacy migration behavior

There is a legacy global API key slot (backing id `openrouter-api-key`, unchanged so existing installs keep data).

The app migrates it to per-account storage and then clears the global slot after the per-user key exists.

This prevents a “cleared key gets repopulated” effect.

## Theme preference (not a secret)

Appearance choice (system / light / dark) is stored with the same storage helper as other prefs but is **not** sensitive. Key: `app_theme_preference_v1` (see `src/constants/theme-preference.ts`).

## Env defaults (local dev only)

The app can also fall back to build-time public env vars:

- `EXPO_PUBLIC_AI_API_KEY`
- `EXPO_PUBLIC_OPENAI_API_KEY`
- `EXPO_PUBLIC_OPENROUTER_API_KEY` (legacy alias)

Expo `EXPO_PUBLIC_*` values are embedded into the app bundle.

Do not treat them as production secrets.

## Auth model is not production-ready

The current authentication is a demo/local implementation:

- Passwords are stored on-device
- Sessions are stored in storage

For a production app, replace `src/ctx/auth-context.tsx` with a real backend auth provider and avoid storing passwords locally.

