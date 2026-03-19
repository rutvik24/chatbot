import { Color } from 'expo-router';
import { Platform, useColorScheme } from 'react-native';

export function useNativeThemeColors() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return {
    background: Platform.select({
      ios: Color.ios.systemBackground,
      android: Color.android.dynamic.surface,
      default: isDark ? '#0F172A' : '#FFFFFF',
    }),
    surface: Platform.select({
      ios: Color.ios.secondarySystemBackground,
      android: Color.android.dynamic.surface,
      default: isDark ? '#111827' : '#F8FAFC',
    }),
    text: Platform.select({
      ios: Color.ios.label,
      android: Color.android.dynamic.onSurface,
      default: isDark ? '#E5E7EB' : '#111827',
    }),
    secondaryText: Platform.select({
      ios: Color.ios.secondaryLabel,
      android: Color.android.dynamic.onSurface,
      default: isDark ? '#9CA3AF' : '#475569',
    }),
    primary: Platform.select({
      ios: Color.ios.systemBlue,
      android: Color.android.dynamic.primary,
      default: '#2563EB',
    }),
    border: Platform.select({
      ios: Color.ios.separator,
      android: Color.android.dynamic.outline,
      default: isDark ? '#334155' : '#D1D5DB',
    }),
    error: Platform.select({
      ios: Color.ios.systemRed,
      android: Color.android.dynamic.error,
      default: '#DC2626',
    }),
    success: Platform.select({
      ios: Color.ios.systemGreen,
      android: Color.android.dynamic.tertiary,
      default: '#16A34A',
    }),
    placeholder: Platform.select({
      ios: Color.ios.secondaryLabel,
      android: Color.android.dynamic.onSurfaceVariant,
      default: '#94A3B8',
    }),
  };
}
