# AI Integration (OpenAI-Compatible Streaming)

The app talks to an OpenAI-compatible provider via `src/services/openrouter-chat.ts`.

## How streaming works

- The chat screen calls `streamChatCompletion()` with:
  - the user’s API key
  - the stored base URL (or the default)
  - a message history array (recent turns + optional system personalization)
- `streamChatCompletion()` uses the OpenAI SDK with `stream: true`
- Token deltas are yielded from the streaming response and appended to the assistant message UI
- A “Stop” button aborts the in-flight request via `AbortController`

Important implementation detail:

- The OpenAI SDK needs a fetch implementation compatible with streaming. The service patches `globalThis.fetch` once to use Expo’s `fetch` (`expo/fetch`).

## Model selection

The chat screen currently uses a hardcoded model id:

- `openrouter/free`

Model selection is not exposed in UI yet.

## Keys and endpoints

The app supports two ways to get AI credentials:

- Saved per-user credentials from `Settings → AI settings`
- Build-time env defaults:
  - `EXPO_PUBLIC_OPENROUTER_API_KEY`
  - `EXPO_PUBLIC_OPENAI_API_KEY`

Build-time keys are embedded into the bundle and are intended for local development only.

Per-user storage:

- API keys and base URLs are stored using secure storage on native via `expo-secure-store`
- On web, storage falls back to `localStorage`
- Storage keys are derived from the active session email (sanitized for safe key naming)

Legacy migration:

- There is a migration path that clears a legacy global API key slot after the per-account key exists, so clearing the per-user key does not re-import old values.

## Base URL normalization

The app normalizes an OpenAI-compatible base URL by:

- trimming trailing slashes
- ensuring an `https://` prefix if missing
- rebuilding a canonical `{origin}{path}` URL for the OpenAI SDK

## Error handling

Provider/SKD errors are mapped to short, user-facing messages in:

- `src/utils/provider-chat-error.ts`

The chat UI avoids injecting a “cancelled” error into the conversation when the user intentionally presses Stop.

