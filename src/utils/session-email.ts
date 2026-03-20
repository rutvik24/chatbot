const SESSION_TOKEN_PREFIX = 'session-';

/**
 * The auth session string is stored as `session-{normalizedEmail}` (see `auth-context`).
 * Use this helper anywhere you show the account email in the UI. Keep using the raw
 * `session` value for storage keys and guards.
 */
export function displayEmailFromSession(
  session: string | null | undefined,
): string {
  if (!session) return '';
  const t = session.trim();
  if (t.startsWith(SESSION_TOKEN_PREFIX)) {
    return t.slice(SESSION_TOKEN_PREFIX.length);
  }
  return t;
}
