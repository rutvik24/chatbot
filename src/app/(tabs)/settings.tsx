import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/common';
import { useSession } from '@/ctx/auth-context';
import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

type SettingsItem = {
  label: string;
  href: '/settings-profile' | '/settings-openrouter';
};

export default function SettingsScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const { signOut } = useSession();
  const [isSignOutModalVisible, setIsSignOutModalVisible] = useState(false);

  const sections: { title: string; data: SettingsItem[] }[] = [
    {
      title: 'Account',
      data: [{ label: 'Profile', href: '/settings-profile' }],
    },
    {
      title: 'AI',
      data: [{ label: 'OpenRouter API Key', href: '/settings-openrouter' }],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.href}
        contentContainerStyle={styles.listContent}
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
            <AppText style={styles.sectionTitle}>Actions</AppText>
            <Pressable
              onPress={() => router.push('/change-password')}
              style={[styles.actionButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <AppText>Change password</AppText>
            </Pressable>
            <Pressable
              onPress={() => setIsSignOutModalVisible(true)}
              style={[styles.actionButton, { borderColor: colors.error, backgroundColor: colors.error }]}>
              <AppText style={styles.signOutText}>Sign out</AppText>
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
  actionButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
