# Chat App

Expo Router chat app with per-user OpenAI-compatible AI streaming (OpenRouter by default).

## Docs Navigation

- [Overview (this README)](#chat-app)
- [`docs/README.md`](docs/README.md)
- [`docs/setup.md`](docs/setup.md)
- [`docs/project-structure.md`](docs/project-structure.md)
- [`docs/current-progress.md`](docs/current-progress.md)
- [`docs/ai-integration.md`](docs/ai-integration.md)
- [`docs/auth.md`](docs/auth.md)
- [`docs/security-and-secrets.md`](docs/security-and-secrets.md)
- [`docs/theming.md`](docs/theming.md)

## Current Progress (Snapshot)

Implemented features:
- Authentication flow (sign in / sign up / change password) backed by local demo storage via `src/ctx/auth-context.tsx`.
- Profile editing in Settings (saved locally per account) via `src/app/(auth)/settings-profile.tsx`.
- AI Settings screen to store an OpenAI-compatible API key + base URL securely on-device via `src/app/(auth)/settings-ai.tsx`.
- Chat UI with streaming responses from OpenAI-compatible providers (OpenRouter by default) using `src/services/openrouter-chat.ts`.
- Markdown rendering for assistant messages, including copy-to-clipboard for code blocks (`src/components/markdown-message.tsx`).
- Native light/dark theming via Expo Router `Color` (`src/hooks/use-native-theme-colors.ts`).

Known demo limitations to address next:
- Auth is a mock (no real backend). Passwords and sessions are stored locally.
- Forgot password is mocked (no email is sent).
- Chat messages are currently kept in-memory (no conversation history persistence).
- Model selection is not exposed in UI yet (model is hardcoded to `openrouter/free` in the chat service).

## Quick Start

1. Install deps
```bash
bun install
```

2. Start (use your preferred target)
```bash
bun run start
# or
bun run android
bun run ios
bun run web
```

3. Lint
```bash
bun run lint
```

## License

This project is available under the terms of the `LICENSE` file in the repository root (MIT).
