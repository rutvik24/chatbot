import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';

import {
  resolveColorSchemeFromPreference,
  storedValueForPreference,
  THEME_PREFERENCE_STORAGE_KEY,
  themePreferenceFromStored,
  type ThemePreference,
} from '@/constants/theme-preference';
import { useStorageState } from '@/hooks/use-storage-state';

export type ThemePreferenceContextValue = {
  /** User choice: system, light, or dark. */
  preference: ThemePreference;
  /** Persist and apply; `system` clears override and follows OS. */
  setPreference: (next: ThemePreference) => void;
  /** Resolved `light` | `dark` after applying preference (for navigation / status bar). */
  resolvedColorScheme: 'light' | 'dark';
  /** Storage finished initial read. */
  isPreferenceReady: boolean;
};

const ThemePreferenceContext = createContext<
  ThemePreferenceContextValue | undefined
>(undefined);

/**
 * Keeps React Native’s color scheme in sync with the user’s theme choice via
 * {@link Appearance.setColorScheme}. Wrap the app near the root (outside or inside auth).
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [[isLoading, stored], setStored] = useStorageState(
    THEME_PREFERENCE_STORAGE_KEY,
  );

  const preference = useMemo(
    () => themePreferenceFromStored(stored),
    [stored],
  );

  // Run before paint so the first frame matches stored preference (avoids dark
  // native header + light JS content flash on iOS).
  useLayoutEffect(() => {
    if (isLoading) return;
    // Android crashes if `null` is passed (native param is non-null). RN expects
    // `'unspecified'` to follow the device theme (see Appearance.setColorScheme).
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [isLoading, preference]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setStored(storedValueForPreference(next));
    },
    [setStored],
  );

  const systemScheme = useColorScheme();
  const resolvedColorScheme = resolveColorSchemeFromPreference(
    preference,
    systemScheme,
  );

  const value = useMemo(
    (): ThemePreferenceContextValue => ({
      preference,
      setPreference,
      resolvedColorScheme,
      isPreferenceReady: !isLoading,
    }),
    [isLoading, preference, resolvedColorScheme, setPreference],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

/**
 * Theme toggle state and the effective light/dark scheme for UI that isn’t tied to tokens.
 */
export function useThemePreference(): ThemePreferenceContextValue {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) {
    throw new Error(
      'useThemePreference must be used within ThemePreferenceProvider',
    );
  }
  return ctx;
}
