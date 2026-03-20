# AI Integration (OpenAI-Compatible Streaming)

The app talks to an OpenAI-compatible provider via `src/services/openai-compatible-chat.ts`.

## How streaming works

- The chat screen calls `streamChatCompletion()` with:
  - the user’s API key
  - the stored base URL (or the default)
  - a message history array (recent turns + optional system personalization)
- **Attachments (images, PDFs, text files):** the composer lets users add files; history is converted in `src/utils/chat-completion-history.ts` into official **`openai` SDK** `ChatCompletionContentPart` values (`text`, `image_url`, `file` with `file_data` / `filename` per the [npm `openai` package](https://www.npmjs.com/package/openai) and [Chat Completions API](https://platform.openai.com/docs/api-reference/chat)). See **`docs/openai-sdk-file-support.md`**. The chosen **model/provider must support vision and/or file inputs** (many free text-only models will error on multimodal payloads).
- `streamChatCompletion()` uses the OpenAI SDK with `stream: true`
- Token deltas are yielded from the streaming response; the UI **buffers** them (~40ms) then appends to the assistant message to limit re-renders
- A **Stop** button aborts the in-flight request via `AbortController`

**Stop / cancel behavior**

- If the user stops before **any** non-empty token (and no pending buffer), the **user message + assistant placeholder** are **removed** from the list and the prompt is put back in the input for editing.
- If **any** content was streamed (or buffer had text when stopped), the **partial assistant message is kept** and the input is **not** refilled.

Important implementation detail:

- The OpenAI SDK needs a fetch implementation compatible with streaming. The service patches `globalThis.fetch` once to use Expo’s `fetch` (`expo/fetch`).

## Model selection

The chat screen loads available models via the **OpenAI SDK** `client.models.list()` (same `baseURL` + API key as chat).

- Default when nothing is saved: `meta-llama/llama-3.2-3b-instruct:free` (works with common OpenRouter-style setups; avoids some shared free pools that rate-limit aggressively—change in Chat if your provider uses different ids)
- The user picks a model from a modal list; the choice is stored per account (secure storage on native, `localStorage` on web)
- Search filters the list; the current selection is pinned at the top if the API list changes
- The **model strip** lives **below** the message field inside the composer card

## Base URL (404 / “not found”)

The OpenAI SDK expects `baseURL` to include the API version segment:

- **Some multi-model gateways** (e.g. openrouter.ai): the app coerces bare host or `/api` to `/api/v1` when the hostname matches.
- **OpenAI:** `https://api.openai.com/v1`
- **Other compatible hosts:** usually `https://your-host/v1` when the path is omitted.

`resolveOpenAiCompatibleBaseUrl()` runs `coerceOpenAiCompatibleBaseUrl()` after normalization so common mistakes don’t 404.

## Keys and endpoints

The app supports two ways to get AI credentials:

- Saved per-user credentials from **Settings → AI settings**
- Build-time env defaults (first match wins):
  - `EXPO_PUBLIC_AI_API_KEY`
  - `EXPO_PUBLIC_OPENAI_API_KEY`
  - `EXPO_PUBLIC_OPENROUTER_API_KEY` (legacy alias)

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

Provider/SDK errors are mapped to **short, safe** user-facing strings in `src/utils/provider-chat-error.ts`:

- No raw JSON, env var names, API keys, or paths in chat copy
- Full payloads are logged with `logChatProviderError` (Metro / native logs)

The chat UI does **not** inject a cancellation error when the user presses **Stop**.
