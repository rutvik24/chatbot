# Current Progress

This document reflects what’s currently implemented in the repo (based on the existing route files and core services).

## Navigation & Screens

The app is split into two main flows using Expo Router guards:

- When signed out: `sign-in`, `sign-up`, `forgot-password`
- When signed in: `tabs` (Chat + Settings) and protected settings screens

Main routes:

- `/(tabs)/index`: Chat screen (message composer + streamed assistant replies)
- `/(tabs)/settings`: Settings list + sign out + error boundary test
- `/(auth)/settings-ai`: Save/clear OpenAI-compatible API key + base URL
- `/(auth)/settings-profile`: Edit first/last name for AI personalization
- `/(auth)/settings-security`: Change password + sign out
- `/(auth)/change-password`: Password change form

## AI Chat (Streaming)

The chat screen supports:

- Streaming assistant replies token-by-token (OpenAI-compatible “chat completions” streaming)
- A “Stop” action that aborts the in-flight request
- Auto-scroll to the bottom when the user is already near the bottom
- Rendering assistant messages as Markdown, including copy-to-clipboard for code blocks

Current prompt strategy:

- The app includes the last ~10 user/assistant turns
- If Profile data exists, it generates a system message with authoritative user facts (`buildUserPersonalizationSystemMessage`)

## Authentication (Demo/Local)

The current authentication system is a demo/local implementation:

- Credentials are stored locally and sessions are represented by `session-<email>` (`src/ctx/auth-context.tsx`)
- Profile is persisted locally so the chat can personalize immediately
- “Forgot password” is currently mocked (it returns success but does not send an email)

## Settings & Secure Storage

Implemented:

- `Settings → AI settings` saves the OpenAI-compatible API key and base URL using secure on-device storage on native
- Keys are stored per account (email-derived storage key)
- There is a migration path from a legacy global API key slot to per-account keys

## Known gaps / Next improvements

Based on the current code:

- No conversation history persistence yet (messages are kept in component state only)
- No UI for selecting the model name (chat uses a hardcoded model id: `openrouter/free`)
- Forgot password is mocked and needs real backend integration
- Auth is local-only; production needs a real auth provider and secure credential handling

