/**
 * Per-account local storage binding for this app.
 *
 * Session ids are `session-{normalizedEmail}` (see `auth-context`). We derive a **stable
 * SecureStore/localStorage key suffix** from the email so the same user always maps to
 * the same keys after sign-out and sign-in again — nothing in `signOut` clears these.
 */
export function getSessionAccountStorageSuffix(
  session: string | null,
): string | null {
  if (!session?.startsWith("session-")) return null;
  const email = session.slice("session-".length);
  if (!email) return null;
  const safe = email.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe || null;
}
