import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  authScrollContentStyle,
  AuthFormCard,
  AuthHero,
} from '@/components/auth';
import { AppText } from '@/components/common';
import { useSession } from '@/ctx/auth-context';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

const HERO_ICON = {
  ios: 'lock.shield.fill' as const,
  android: 'shield' as const,
  web: 'shield' as const,
};

function cardShadow() {
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 16,
    },
    android: { elevation: 3 },
    default: {},
  });
}

export default function SettingsSecurityScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { signOut } = useSession();

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[authScrollContentStyle, styles.scroll]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior={
          Platform.OS === 'ios' ? 'automatic' : undefined
        }
      >
        <AuthFormCard>
          <AuthHero
            title="Security"
            subtitle="Update your password or sign out on this device."
            icon={HERO_ICON}
          />

          <Pressable
            onPress={() => router.push('/change-password')}
            accessibilityRole="button"
            accessibilityLabel="Change password"
            style={({ pressed }) => [
              styles.row,
              {
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surface : colors.background,
              },
              cardShadow(),
            ]}
          >
            <View
              style={[
                styles.rowIcon,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <SymbolView
                name={{
                  ios: 'key.fill',
                  android: 'vpn_key',
                  web: 'vpn_key',
                }}
                size={22}
                tintColor={colors.primary}
              />
            </View>
            <View style={styles.rowText}>
              <AppText style={[styles.rowTitle, { color: colors.text }]}>
                Change password
              </AppText>
              <AppText muted style={styles.rowHint}>
                Use a strong password you don’t reuse elsewhere
              </AppText>
            </View>
            <SymbolView
              name={{
                ios: 'chevron.right',
                android: 'chevron_right',
                web: 'chevron_right',
              }}
              size={14}
              tintColor={colors.secondaryText}
            />
          </Pressable>

          <Pressable
            onPress={signOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [
              styles.signOutRow,
              {
                borderColor: colors.error,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <SymbolView
              name={{
                ios: 'rectangle.portrait.and.arrow.right',
                android: 'logout',
                web: 'logout',
              }}
              size={22}
              tintColor={colors.error}
            />
            <AppText style={[styles.signOutLabel, { color: colors.error }]}>
              Sign out
            </AppText>
          </Pressable>

          <AppText muted style={styles.footerNote}>
            Signing out clears your session on this device. Your saved API key
            and profile stay in local storage until you remove them.
          </AppText>
        </AuthFormCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    justifyContent: 'flex-start',
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  rowHint: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  signOutLabel: {
    fontSize: 17,
    fontWeight: '800',
  },
  footerNote: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
});
