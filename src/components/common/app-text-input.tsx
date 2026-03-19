import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import AppText from '@/components/common/app-text';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

export type AppTextInputProps = TextInputProps & {
  label?: string;
  error?: string;
  isPasswordField?: boolean;
};

export default function AppTextInput({
  label,
  error,
  isPasswordField = false,
  secureTextEntry,
  style,
  ...props
}: AppTextInputProps) {
  const colors = useNativeThemeColors();
  const [isVisible, setIsVisible] = useState(false);
  const isSecure = isPasswordField ? !isVisible : secureTextEntry;

  return (
    <View style={styles.wrapper}>
      {label ? <AppText style={styles.label}>{label}</AppText> : null}
      <View style={[styles.inputContainer, { borderColor: error ? colors.error : colors.border }]}>
        <TextInput
          {...props}
          secureTextEntry={isSecure}
          style={[styles.input, { color: colors.text }, style]}
          placeholderTextColor={colors.placeholder}
        />
        {isPasswordField ? (
          <Pressable onPress={() => setIsVisible((value) => !value)} hitSlop={8}>
            <SymbolView
              name={
                isVisible
                  ? { ios: 'eye', android: 'visibility', web: 'visibility' }
                  : { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }
              }
              size={18}
              tintColor={colors.secondaryText}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <AppText style={[styles.error, { color: colors.error }]}>{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  error: {
    fontSize: 12,
    fontWeight: '600',
  },
});
