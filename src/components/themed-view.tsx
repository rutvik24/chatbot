import { View, type ViewProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Props for {@link ThemedView}.
 *
 * `type` selects which background color from the theme palette to use.
 * You can override colors via `lightColor` and `darkColor`.
 */
export type ThemedViewProps = ViewProps & {
  /**
   * Override background color in light mode.
   */
  lightColor?: string;
  /**
   * Override background color in dark mode.
   */
  darkColor?: string;
  /**
   * Theme color token (background/backgroundElement/etc).
   */
  type?: ThemeColor;
};

/**
 * View wrapper that applies theme-aware background colors.
 */
export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();

  return <View style={[{ backgroundColor: theme[type ?? 'background'] }, style]} {...otherProps} />;
}
