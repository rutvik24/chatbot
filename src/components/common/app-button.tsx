import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import AppText from '@/components/common/app-text';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

export type AppButtonProps = PressableProps & {
  label: string;
};

export default function AppButton({ label, disabled, style, ...props }: AppButtonProps) {
  const colors = useNativeThemeColors();

  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={(state) => [
        styles.button,
        {
          backgroundColor: disabled ? colors.border : colors.primary,
          opacity: state.pressed ? 0.85 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}>
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
