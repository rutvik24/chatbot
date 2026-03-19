import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import AppText from '@/components/common/app-text';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

/**
 * Props for {@link AppButton}.
 *
 * @example
 * <AppButton label="Save" onPress={handleSave} />
 * <AppButton label="Cancel" variant="secondary" onPress={handleCancel} />
 */
export type AppButtonProps = PressableProps & {
  label: string;
  /** `secondary` = outlined / muted (e.g. cancel, reset). Default is filled primary. */
  variant?: 'primary' | 'secondary';
};

/**
 * Primary CTA button with theming and a `secondary` outlined variant.
 */
export default function AppButton({
  label,
  disabled,
  variant = 'primary',
  style,
  ...props
}: AppButtonProps) {
  const colors = useNativeThemeColors();
  const isSecondary = variant === 'secondary';

  const labelColor = (() => {
    if (disabled) {
      return isSecondary ? colors.secondaryText : '#FFFFFF';
    }
    return isSecondary ? colors.primary : '#FFFFFF';
  })();

  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={(state) => [
        styles.button,
        {
          backgroundColor: disabled
            ? isSecondary
              ? colors.surface
              : colors.border
            : isSecondary
              ? colors.surface
              : colors.primary,
          borderWidth: isSecondary ? 1 : 0,
          borderColor: disabled
            ? colors.border
            : isSecondary
              ? colors.primary
              : 'transparent',
          opacity: state.pressed ? 0.85 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}>
      <AppText style={[styles.label, { color: labelColor }]} numberOfLines={2}>
        {label}
      </AppText>
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
    textAlign: 'center',
  },
});
