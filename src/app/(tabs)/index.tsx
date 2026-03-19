import { router } from 'expo-router';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import { AppButton, AppText } from '@/components/common';
import { useSession } from '@/ctx/auth-context';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

export default function HomeScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { signOut, session } = useSession();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText style={styles.title}>Authenticated Home</AppText>
        <AppText muted>You are signed in and this route is protected.</AppText>
        <AppText muted numberOfLines={1}>
          Session: {session}
        </AppText>

        <Pressable onPress={() => router.push('/change-password')}>
          <AppText style={styles.linkText}>Change password</AppText>
        </Pressable>

        <AppButton label="Sign Out" onPress={signOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  linkText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
