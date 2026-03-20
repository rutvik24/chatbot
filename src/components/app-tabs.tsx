import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { useColorScheme } from 'react-native';

import { useNativeThemeColors } from '@/hooks/use-native-theme-colors';

/**
 * Native tab bar for the logged-in experience (Chat + Settings).
 *
 * Uses `expo-router/unstable-native-tabs` so it stays native-feeling on iOS/Android.
 */
export default function AppTabs() {
  useColorScheme();
  const colors = useNativeThemeColors();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.primary}
      iconColor={{ default: colors.secondaryText, selected: colors.text }}
      labelStyle={{ default: { color: colors.secondaryText }, selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{
            default: 'bubble.left.and.bubble.right',
            selected: 'bubble.left.and.bubble.right.fill',
          }}
          md="chat_bubble"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          md="settings"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
