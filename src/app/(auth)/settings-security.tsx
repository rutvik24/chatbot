import { router } from 'expo-router';
import { ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText } from '@/components/common';
import { useSession } from '@/ctx/auth-context';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

export default function SettingsSecurityScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { signOut } = useSession();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText style={styles.title}>Security</AppText>
        <AppText muted>Manage password and account session.</AppText>

        <AppButton label="Change Password" onPress={() => router.push('/change-password')} />
        <AppButton label="Sign Out" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 26, fontWeight: '700' },
});
