export type UserProfileFields = {
  firstName: string;
  lastName: string;
};

/** Per-account profile blob in storage (`profile_<sanitizedEmail>`). */
export function getUserProfileStorageKey(session: string | null): string {
  const email = session?.startsWith('session-')
    ? session.slice('session-'.length)
    : '';
  const safeEmailKeyPart = (email || 'anonymous').replace(
    /[^a-zA-Z0-9._-]/g,
    '_',
  );
  return `profile_${safeEmailKeyPart}`;
}

export function parseUserProfileFromStorage(
  value: string | null,
): UserProfileFields {
  if (!value) {
    return { firstName: '', lastName: '' };
  }
  try {
    const parsed = JSON.parse(value) as Partial<UserProfileFields>;
    return {
      firstName:
        typeof parsed.firstName === 'string' ? parsed.firstName.trim() : '',
      lastName:
        typeof parsed.lastName === 'string' ? parsed.lastName.trim() : '',
    };
  } catch {
    return { firstName: '', lastName: '' };
  }
}

/**
 * System context: explicit user facts so the model can answer “what’s my name?”
 * and personalize without pretending it lacks that information.
 */
export function buildUserPersonalizationSystemMessage(
  session: string | null,
  profileJson: string | null,
): { role: 'system'; content: string } | null {
  if (!session?.startsWith('session-')) {
    return null;
  }
  const email = session.slice('session-'.length);
  const profile = parseUserProfileFromStorage(profileJson);
  const first = profile.firstName || '';
  const last = profile.lastName || '';
  const displayName = [first, last].filter(Boolean).join(' ').trim();

  const firstLine = first
    ? `First name (from Profile): ${first}.`
    : 'First name (from Profile): not set — user can add it in Settings → Profile.';
  const lastLine = last
    ? `Last name (from Profile): ${last}.`
    : 'Last name (from Profile): not set — user can add it in Settings → Profile.';
  const nameAnswerLine = displayName
    ? `If they ask what their name is or what you call them, their saved name is “${displayName}”.`
    : `If they ask what their name is, say no display name is saved in Profile yet and suggest they add it in Settings → Profile; you may mention their sign-in email if helpful.`;

  const content = [
    'You are helping a user who is signed into this app. The following lines are authoritative facts from their account and Profile screen.',
    '',
    firstLine,
    lastLine,
    displayName
      ? `Full / preferred name to use in conversation: ${displayName}.`
      : 'Full / preferred name: (none saved yet).',
    `Sign-in email: ${email}.`,
    '',
    nameAnswerLine,
    'Use their name naturally in replies when it fits. Do not claim you cannot see their name if it is listed above; if only email is available, you may say that and offer to use how they introduce themselves.',
  ].join('\n');

  return { role: 'system', content };
}
