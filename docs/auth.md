# Authentication (Current Demo Model)

Authentication is implemented as an in-app demo/local flow in `src/ctx/auth-context.tsx`.

## Session model

- A successful sign-in sets `session-<normalizedEmail>` as the session id.
- The root router uses this session to protect routes via `Stack.Protected`.

## Credentials storage (demo/local)

This app stores demo credentials on-device:

- Passwords are persisted locally under the `auth-passwords` storage key.
- The demo storage layer uses secure storage on native and `localStorage` on web (`src/hooks/use-storage-state.ts`).

## Sign-in / Sign-up

- `sign-up`: saves the password and writes a profile record (first/last name) to storage so the chat can personalize immediately.
- `sign-in`: verifies the email + password combination from the locally stored data.

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

