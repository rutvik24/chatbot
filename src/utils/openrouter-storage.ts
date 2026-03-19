export function getOpenRouterApiKeyStorageKey(session: string | null): string {
  const email = session?.startsWith('session-') ? session.slice('session-'.length) : null;
  if (!email) return 'openrouter-api-key';

  // SecureStore keys must be alphanumeric + ".", "-", "_" only.
  // Emails contain characters like "@" so we sanitize to a safe representation.
  const safeEmail = email.replace(/[^a-zA-Z0-9._-]/g, '_');

  return safeEmail ? `openrouter-api-key-${safeEmail}` : 'openrouter-api-key';
}

