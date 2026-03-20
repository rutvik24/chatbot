import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/common';
import type { ThemePreference } from '@/constants/theme-preference';
import { useSession } from '@/ctx/auth-context';
import { useThemePreference } from '@/ctx/theme-preference-context';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

type SettingsItem = {
  label: string;
  href: '/settings-profile' | '/settings-ai';
};

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  hint: string;
}[] = [
  {
    value: 'system',
    label: 'System',
    hint: 'Match device light or dark mode',
  },
  { value: 'light', label: 'Light', hint: 'Always use light appearance' },
  { value: 'dark', label: 'Dark', hint: 'Always use dark appearance' },
];

export default function SettingsScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { preference, setPreference } = useThemePreference();
  const { signOut } = useSession();
  const [isSignOutModalVisible, setIsSignOutModalVisible] = useState(false);
  const [shouldTestBoundary, setShouldTestBoundary] = useState(false);

  if (shouldTestBoundary) {
    throw new Error('Test ErrorBoundary');
  }

  const sections: { title: string; data: SettingsItem[] }[] = [
    {
      title: 'Account',
      data: [{ label: 'Profile', href: '/settings-profile' }],
    },
    {
      title: 'AI',
      data: [{ label: 'AI settings', href: '/settings-ai' }],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.href}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.themeBlock}>
            <AppText style={styles.sectionTitle}>Appearance</AppText>
            <View
              style={[
                styles.themeCard,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              {THEME_OPTIONS.map((opt, index) => {
                const selected = preference === opt.value;
                const isLast = index === THEME_OPTIONS.length - 1;
                return (
                  <Pressable
                    key={opt.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${opt.label}. ${opt.hint}`}
                    onPress={() => setPreference(opt.value)}
                    style={({ pressed }) => [
                      styles.themeRow,
                      {
                        borderColor: colors.border,
                        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                        backgroundColor: pressed
                          ? colors.background
                          : 'transparent',
                      },
                    ]}
                  >
                    <View style={styles.themeRowText}>
                      <AppText
                        style={{
                          fontWeight: selected ? '800' : '600',
                          color: colors.text,
                        }}
                      >
                        {opt.label}
                      </AppText>
                      <AppText muted style={styles.themeHint}>
                        {opt.hint}
                      </AppText>
                    </View>
                    {selected ? (
                      <SymbolView
                        name={{
                          ios: 'checkmark.circle.fill',
                          android: 'check_circle',
                          web: 'check_circle',
                        }}
                        size={22}
                        tintColor={colors.primary}
                      />
                    ) : (
                      <View style={styles.themeCheckPlaceholder} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <AppText style={styles.sectionTitle}>{section.title}</AppText>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(item.href)}
            style={[styles.itemRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <AppText>{item.label}</AppText>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={styles.footerActions}>
            <AppText style={styles.sectionTitle}>Account Actions</AppText>

            <Pressable
              onPress={() => {
                setShouldTestBoundary(true);
                // Reset quickly so pressing "Try again" actually clears the error state.
                setTimeout(() => setShouldTestBoundary(false), 0);
              }}
              style={[
                styles.itemRow,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}>
              <AppText>Test ErrorBoundary</AppText>
            </Pressable>

            <Pressable
              onPress={() => router.push('/change-password')}
              style={[
                styles.itemRow,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}>
              <AppText>Change password</AppText>
            </Pressable>

            <Pressable
              onPress={() => setIsSignOutModalVisible(true)}
              style={[
                styles.itemRow,
                styles.signOutRow,
                { borderColor: colors.error, backgroundColor: colors.error },
              ]}>
              <AppText style={[styles.signOutText, styles.signOutLabel]}>Sign out</AppText>
              <SymbolView
                name={{
                  ios: 'rectangle.portrait.and.arrow.right',
                  android: 'logout',
                  web: 'logout',
                }}
                size={20}
                tintColor="#FFFFFF"
              />
            </Pressable>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />

      <Modal
        visible={isSignOutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSignOutModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText style={styles.modalTitle}>Confirm sign out</AppText>
            <AppText muted>Are you sure you want to sign out from this account?</AppText>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setIsSignOutModalVisible(false)}
                style={[styles.modalButton, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <AppText>Cancel</AppText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIsSignOutModalVisible(false);
                  signOut();
                }}
                style={[styles.modalButton, { borderColor: colors.error, backgroundColor: colors.error }]}>
                <AppText style={styles.signOutText}>Sign out</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  themeBlock: {
    marginBottom: 8,
    gap: 8,
  },
  themeCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  themeRowText: {
    flex: 1,
    gap: 4,
  },
  themeHint: {
    fontSize: 12,
    fontWeight: '500',
  },
  themeCheckPlaceholder: {
    width: 22,
    height: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 8,
  },
  itemRow: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
  },
  footerActions: {
    marginTop: 16,
    gap: 8,
  },
  signOutRow: {
    justifyContent: 'space-between',
  },
  signOutLabel: {
    flex: 1,
  },
  signOutText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
