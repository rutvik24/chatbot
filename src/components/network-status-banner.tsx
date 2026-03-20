import { ActivityIndicator, Pressable, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/common";
import { useNetworkStateManager } from "@/ctx/network-state-context";
import { useNativeThemeColors } from "@/hooks/use-native-theme-colors";

/**
 * Sticky notice when the device is offline, with a manual refresh action.
 */
export default function NetworkStatusBanner() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const insets = useSafeAreaInsets();
  const { isOnline, isRefreshing, refresh } = useNetworkStateManager();

  if (isOnline) return null;

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingVertical: 10,
          paddingHorizontal: 16,
        }}>
        <AppText style={{ flex: 1, fontSize: 14, color: colors.text }}>
          No internet connection. Messages won’t send until you’re back online.
        </AppText>
        <Pressable
          onPress={() => void refresh()}
          disabled={isRefreshing}
          style={({ pressed }) => ({
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 10,
            backgroundColor: colors.primary,
            opacity: pressed || isRefreshing ? 0.75 : 1,
            minWidth: 88,
            alignItems: "center",
            justifyContent: "center",
          })}>
          {isRefreshing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <AppText
              style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
              Retry
            </AppText>
          )}
        </Pressable>
      </View>
    </View>
  );
}
