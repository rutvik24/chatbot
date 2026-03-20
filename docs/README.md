# Documentation

This folder contains the developer docs for the project.

## Navigation

- [`setup.md`](setup.md) - prerequisites and how to run the app
- [`project-structure.md`](project-structure.md) - how the codebase is organized
- [`current-progress.md`](current-progress.md) - what’s implemented today vs gaps (drawer, tab headers, chat UX)
- [`ai-integration.md`](ai-integration.md) - OpenAI-compatible streaming
- [`auth.md`](auth.md) - current authentication model (demo/local)
- [`security-and-secrets.md`](security-and-secrets.md) - how API keys are stored and migrated
- [`theming.md`](theming.md) - appearance override, Android vs iOS colors, navigation theme
- [`deep-links.md`](deep-links.md) - chat share URLs, `bunx uri-scheme open` for Expo Go, converting `chatapp://` → `exp://…/--/chat/<id>`

## Conventions

- Commands use **bun** (see [`setup.md`](setup.md)).
- Expo Router file-based routing: routes live under `src/app/`.
- **License:** proprietary — see root `LICENSE` (README may summarize features; legal terms are in `LICENSE`).
