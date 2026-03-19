import { StyleSheet, View } from 'react-native';

import AppText from '@/components/common/app-text';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';
import { getPasswordChecks } from '@/utils/password-validation';

/**
 * Props for {@link PasswordChecklist}.
 */
type PasswordChecklistProps = {
  /**
   * Password to validate against the checklist rules.
   */
  password: string;
};

/**
 * Displays which password-strength rules are currently satisfied.
 *
 * Intended for sign-up and password-change forms.
 */
export default function PasswordChecklist({ password }: PasswordChecklistProps) {
  const colors = useNativeThemeColors();
  const checks = getPasswordChecks(password);

  const items = [
    { key: 'minLength', label: 'Minimum 8 characters', met: checks.minLength },
    { key: 'hasLowercase', label: 'At least 1 lowercase letter', met: checks.hasLowercase },
    { key: 'hasUppercase', label: 'At least 1 uppercase letter', met: checks.hasUppercase },
    { key: 'hasNumber', label: 'At least 1 number', met: checks.hasNumber },
    { key: 'hasSpecial', label: 'At least 1 special character', met: checks.hasSpecial },
  ];

  return (
    <View style={styles.container}>
      {items.map((item) => (
        <AppText key={item.key} style={[styles.item, { color: item.met ? colors.success : colors.error }]}>
          {item.met ? '✓' : '•'} {item.label}
        </AppText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  item: {
    fontSize: 12,
    fontWeight: '600',
  },
});
