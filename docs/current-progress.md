# Current Progress

This document matches the behavior in the repo today (chat, settings, AI, theming, navigation).

## Navigation & Screens

Expo Router **Stack** + **guards**:

- **Signed out:** `sign-in`, `sign-up`, `forgot-password` (each with a **native** stack header, titles in `src/app/_layout.tsx`)
- **Signed in:** **drawer** (`expo-router/drawer`) wraps **native tabs** (**Chat**, **Settings**); stack settings routes (native headers)

**Sign in** is the root of the logged-out stack: **`headerBackVisible: false`** (no back). **Drawer + native tabs** use `headerShown: false` on that shell; each tab screen renders its own **in-content** header (see below).

### Tab screen headers (Chat & Settings)

- **`TabScreenHeader`** (`src/components/tab-screen-header.tsx`) — centered **title** matching the tab (**Chat** / **Settings**) and a **☰** control that dispatches **`DrawerActions.openDrawer()`**.
- Native **`NativeTabs.Trigger.Label`** still drives the **bottom tab bar** item titles; the header is separate (native tab screens don’t expose a stack-style title bar inside the tab content).

Main routes:

| Route | Purpose |
|--------|---------|
| `/(main)/(tabs)/index` | Chat: **`TabScreenHeader`** “Chat”; streaming, composer, model picker strip, scroll / catch-up UX; **New chat** in drawer |
| `/(main)/(tabs)/settings` | **`TabScreenHeader`** “Settings”; Profile & AI links, **Appearance**, sign out, error-boundary test; **☰** opens same drawer (**New chat**) |
| `/(auth)/settings-ai` | API key, base URL (scroll; `SafeAreaView` edges bottom/left/right under header) |
| `/(auth)/settings-profile` | Name fields for personalization system message |
| `/(auth)/settings-security` | Change password + sign out |
| `/(auth)/change-password` | Password change |
| `/(auth)/sign-in` | Sign in (native header, no back) |
| `/(auth)/sign-up` | Create account |
| `/(auth)/forgot-password` | Forgot password |

### Root layout (`src/app/_layout.tsx`)

`ThemePreferenceProvider` → `SessionProvider` → `ThemeProvider` (`createAppNavigationTheme(resolvedColorScheme)`) → `Stack` with **functional** `screenOptions={({ theme }) => …}` so headers read live theme colors. **`headerLargeTitleEnabled: false`** globally. iOS: `headerBlurEffect: 'none'` for solid bars; `headerBackButtonDisplayMode: 'generic'` for Back + chevron when space allows.

Auth/settings scroll screens use **`SafeAreaView` `edges={['bottom','left','right']}`** under the native header and iOS **`contentInsetAdjustmentBehavior="automatic"`** on `ScrollView` where applicable.

## Chat (`/(main)/(tabs)/index`)

- **Streaming** — OpenAI-compatible `stream: true`; tokens batched ~40ms before UI append for performance.
- **Stop** — `AbortController`; cancellation is not shown as an error in the bubble.
  - **No assistant output yet** — last user message + empty assistant row removed; same text restored to the composer (edit/resend).
  - **Any tokens received** — user + partial assistant messages kept; composer not refilled.
- **Model** — Modal list from `client.models.list()` when opened; selection stored per account; default model in `DEFAULT_CHAT_MODEL_ID` (`openai-compatible-chat.ts`).
- **Scroll** — `shouldAutoScrollRef` + **stick-to-bottom** after send or **Catch up**; `onContentSizeChange` + scheduled `scrollToEnd` while following; wider cancel threshold while generating so layout jitter doesn’t drop follow mode.
- **Catch up / Latest** — Floating button above the composer when not at bottom; **Catch up** variant while generating; docked with elevation so it stays visible on Android.
- **UI** — **`TabScreenHeader`** (title + drawer); day pills with calendar icon; message times; user primary bubble vs assistant surface bubble (shadows / elevation); unified composer card (outer shadow, inner clip).
- **New chat** (drawer) — Aborts stream, clears messages/composer/error, closes model picker, resets scroll to top; navigates to Chat tab; if Chat isn’t mounted, reset runs when the screen registers (**`ChatActionsProvider`** pending flag).

## Settings (`/(main)/(tabs)/settings`)

- **`TabScreenHeader`** — “Settings” + ☰ (drawer).
- **`ScrollView`** — profile **hero card** (avatar initial, signed-in email, tap → Profile); **Appearance** as three **chips** (System / Light / Dark) with icons; **Account** and **Security** grouped cards with icon rows, titles, short descriptions, and chevrons; outlined **Sign out** + helper copy; **sign-out modal** with icon, clearer title/body, Cancel / Sign out.
- **`__DEV__`** — ErrorBoundary test is a small footer link (not a primary row).

## Prompt / history

- Last ~**10** user/assistant turns sent to the model.
- Optional **system** message from profile + session (`buildUserPersonalizationSystemMessage`).

## Authentication (demo / local)

- Credentials and sessions in local storage (`src/ctx/auth-context.tsx`).
- Forgot password **mocked** (no email).

## Settings & storage

- AI key + base URL + chat model id: **per account**, secure storage on native, `localStorage` on web.
- **Theme preference** (`system` / `light` / `dark`): device-local key `app_theme_preference_v1` (same storage abstraction; not a secret). See `src/constants/theme-preference.ts` + `src/ctx/theme-preference-context.tsx`.
- Legacy global API key migration (see `security-and-secrets.md`).

## Known gaps

- No **server** auth or synced history.
- No **persistent** chat threads (reload loses in-memory messages).
- Forgot password and auth need a real backend for production.
