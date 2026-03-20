import { Color } from 'expo-router';
import { Platform, useColorScheme } from 'react-native';

import { useThemePreference } from '@/ctx/theme-preference-context';
import { materialAndroidUiColors } from '@/utils/navigation-theme';

/**
 * Semantic colors from the Expo Router `Color` API (iOS) with web fallbacks.
 * Android uses {@link materialAndroidUiColors} so UI matches Settings → Appearance
 * (`Appearance.setColorScheme`); dynamic Material tokens follow device night mode only.
 */
export function useNativeThemeColors() {
  useColorScheme();
  const { resolvedColorScheme } = useThemePreference();
  const isDark = resolvedColorScheme === 'dark';

  if (Platform.OS === 'android') {
    const c = materialAndroidUiColors(isDark);
    return {
      background: c.background,
      surface: c.surface,
      text: c.text,
      secondaryText: c.secondaryText,
      primary: c.primary,
      border: c.border,
      error: c.error,
      success: c.success,
      placeholder: c.placeholder,
    };
  }

  return {
    background: Platform.select({
      ios: Color.ios.systemBackground,
      default: isDark ? '#0F172A' : '#FFFFFF',
    }),
    surface: Platform.select({
      ios: Color.ios.secondarySystemBackground,
      default: isDark ? '#111827' : '#F8FAFC',
    }),
    text: Platform.select({
      ios: Color.ios.label,
      default: isDark ? '#E5E7EB' : '#111827',
    }),
    secondaryText: Platform.select({
      ios: Color.ios.secondaryLabel,
      default: isDark ? '#9CA3AF' : '#475569',
    }),
    primary: Platform.select({
      ios: Color.ios.systemBlue,
      default: '#2563EB',
    }),
    border: Platform.select({
      ios: Color.ios.separator,
      default: isDark ? '#334155' : '#D1D5DB',
    }),
    error: Platform.select({
      ios: Color.ios.systemRed,
      default: '#DC2626',
    }),
    success: Platform.select({
      ios: Color.ios.systemGreen,
      default: '#16A34A',
    }),
    placeholder: Platform.select({
      ios: Color.ios.secondaryLabel,
      default: '#94A3B8',
    }),
  };
}
