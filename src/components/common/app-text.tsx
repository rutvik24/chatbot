import { Text, type TextProps } from 'react-native';

import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

/**
 * Props for {@link AppText}.
 *
 * @remarks
 * This is the app's themed text wrapper. It uses `useNativeThemeColors()` to
 * pick the right color for the current light/dark theme.
 */
export type AppTextProps = TextProps & {
  /**
   * When `true`, text color switches to the app's secondary label color.
   */
  muted?: boolean;
};

/**
 * Themed text component.
 *
 * Use `muted` for secondary copy (help text, descriptions, etc.).
 */
export default function AppText({ style, muted = false, ...props }: AppTextProps) {
  const colors = useNativeThemeColors();

  return <Text {...props} style={[{ color: muted ? colors.secondaryText : colors.text }, style]} />;
}
