/**
 * Persisted appearance: follow OS, or lock to light / dark.
 * Stored value is `null` (removed) for system, or `"light"` / `"dark"`.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

/** SecureStore / localStorage key (device-local, not secret). */
export const THEME_PREFERENCE_STORAGE_KEY = 'app_theme_preference_v1';

/**
 * Maps stored string (or missing) to a preference for UI + {@link Appearance.setColorScheme}.
 */
export function themePreferenceFromStored(
  stored: string | null | undefined,
): ThemePreference {
  if (stored === 'light' || stored === 'dark') return stored;
  return 'system';
}

/**
 * Value to persist: `null` clears storage and means “system”.
 */
export function storedValueForPreference(
  preference: ThemePreference,
): string | null {
  return preference === 'system' ? null : preference;
}
