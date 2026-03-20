import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { Platform } from 'react-native';

/**
 * Android: do not use `Color.android.dynamic.*` for app chrome — those track the
 * device night mode, not `Appearance.setColorScheme`, so “Light”/“Dark” in Settings
 * looked inverted. This palette follows {@link createAppNavigationTheme}’s intent.
 */
export function materialAndroidUiColors(isDark: boolean) {
  return {
    background: isDark ? '#121212' : '#FFFFFF',
    surface: isDark ? '#1E1E1E' : '#F3F3F3',
    text: isDark ? '#E6E1E5' : '#1C1B1F',
    secondaryText: isDark ? '#CAC4D0' : '#625B71',
    primary: isDark ? '#D0BCFF' : '#6750A4',
    border: isDark ? '#49454F' : '#CAC4D0',
    error: isDark ? '#F2B8B5' : '#B3261E',
    success: isDark ? '#9BD69A' : '#1B5E20',
    placeholder: isDark ? '#938F99' : '#79747E',
  };
}

/**
 * React Navigation’s native stack reads header styling from the navigation
 * theme (`colors.card`, `colors.text`, `colors.primary`), not only `screenOptions`.
 * Values must be strings here (Theme typing); they track the same light/dark
 * intent as {@link useNativeThemeColors} / Settings → Appearance.
 */
export function createAppNavigationTheme(
  resolvedScheme: 'light' | 'dark',
): Theme {
  const isDark = resolvedScheme === 'dark';
  const base = isDark ? DarkTheme : DefaultTheme;
  const { bg, text, border, primary } = navigationColorStrings(isDark);

  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary,
      background: bg,
      card: bg,
      text,
      border,
    },
  };
}

function navigationColorStrings(isDark: boolean) {
  if (Platform.OS === 'ios') {
    return {
      bg: isDark ? '#000000' : '#FFFFFF',
      text: isDark ? '#FFFFFF' : '#000000',
      border: isDark ? '#38383A' : '#C6C6C8',
      primary: isDark ? '#0A84FF' : '#007AFF',
    };
  }
  if (Platform.OS === 'android') {
    const c = materialAndroidUiColors(isDark);
    return {
      bg: c.background,
      text: c.text,
      border: c.border,
      primary: c.primary,
    };
  }
  return {
    bg: isDark ? '#0F172A' : '#FFFFFF',
    text: isDark ? '#E5E7EB' : '#111827',
    border: isDark ? '#334155' : '#D1D5DB',
    primary: '#2563EB',
  };
}
