import { Appearance } from 'react-native';

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

/**
 * Effective light/dark for chrome (navigation header, status bar, etc.).
 * Prefer explicit user choice over `useColorScheme()` so native headers stay in
 * sync with JS-themed screens when Appearance updates.
 */
export function resolveColorSchemeFromPreference(
  preference: ThemePreference,
  systemScheme: 'light' | 'dark' | 'unspecified' | null | undefined,
): 'light' | 'dark' {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  if (systemScheme === 'dark') return 'dark';
  if (systemScheme === 'light') return 'light';
  const fromAppearance = Appearance.getColorScheme();
  if (fromAppearance === 'dark') return 'dark';
  if (fromAppearance === 'light') return 'light';
  return 'light';
}
