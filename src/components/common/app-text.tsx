import { Text, type TextProps } from 'react-native';

import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

export type AppTextProps = TextProps & {
  muted?: boolean;
};

export default function AppText({ style, muted = false, ...props }: AppTextProps) {
  const colors = useNativeThemeColors();

  return <Text {...props} style={[{ color: muted ? colors.secondaryText : colors.text }, style]} />;
}
