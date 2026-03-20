# Authentication (Current Demo Model)

Authentication is implemented as an in-app demo/local flow in `src/ctx/auth-context.tsx`.

## Session model

- A successful sign-in sets `session-<normalizedEmail>` as the session id.
- The root router uses this session to protect routes via `Stack.Protected`.
- **UI:** use `displayEmailFromSession()` from `src/utils/session-email.ts` to show the real address (strip the `session-` prefix). Keep the raw session string for storage keys (`getAiApiKeyStorageKey`, profile keys, etc.).

## Credentials storage (demo/local)

This app stores demo credentials on-device:

- Passwords are persisted locally under the `auth-passwords` storage key.
- The demo storage layer uses secure storage on native and `localStorage` on web (`src/hooks/use-storage-state.ts`).

## Sign-in / Sign-up

- `sign-up`: saves the password and writes a profile record (first/last name) to storage so the chat can personalize immediately.
- `sign-in`: verifies the email + password combination from the locally stored data.

### Stack UI (logged-out)

Sign-in, sign-up, and forgot-password use the **native stack** header from `src/app/_layout.tsx` (themed title + back where applicable). **Sign-in** is the root of the logged-out stack: **`headerBackVisible: false`**. Scrollable bodies use `SafeAreaView` edges that avoid double top inset under the header (see [`current-progress.md`](current-progress.md)).

## Forgot password

- `forgotPassword(email)` returns success only if the email exists in the local credential store.
- It does not send an email link yet (mock behavior).

## Change password

- `changePassword()` checks:
  - user is authenticated (session exists)
  - current password matches stored password
- If successful, it updates the locally stored password and returns `{ ok: true }`.

## Profile

- Profile is stored per account via the `getUserProfileStorageKey()` helper.
- The chat screen uses `buildUserPersonalizationSystemMessage()` to translate Profile fields into an AI system message.

