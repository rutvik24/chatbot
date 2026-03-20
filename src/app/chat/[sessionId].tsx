import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "@/components/common";
import { useSession } from "@/ctx/auth-context";
import { useChatHistory } from "@/ctx/chat-history-context";
import { useNativeThemeColors } from "@/hooks/use-native-theme-colors";
import { setPendingChatDeepLink } from "@/utils/chat-deeplink-pending";
import { showToast } from "@/utils/toast-bus";

/**
 * Handles `chatapp://chat/<sessionId>` (and dev client equivalents).
 * Opens the thread from **this device’s** encrypted history for the signed-in account.
 */
export default function ChatDeepLinkScreen() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { session, isLoading: isSessionLoading } = useSession();
  const { openHistorySession } = useChatHistory();

  useEffect(() => {
    if (isSessionLoading) return;

    const raw = Array.isArray(sessionId) ? sessionId[0] : sessionId;
    if (!raw || typeof raw !== "string") {
      router.replace("/(main)/(tabs)");
      return;
    }

    const id = decodeURIComponent(raw.trim());
    if (!id) {
      router.replace("/(main)/(tabs)");
      return;
    }

    if (!session) {
      setPendingChatDeepLink(id);
      router.replace("/(auth)/sign-in");
      showToast({
        variant: "info",
        title: "Sign in",
        message: "After you sign in, we’ll open that chat if it’s in your history.",
      });
      return;
    }

    let cancelled = false;

    void (async () => {
      const ok = await openHistorySession(id);
      if (cancelled) return;
      if (!ok) {
        showToast({
          variant: "info",
          title: "Chat not found",
          message:
            "That conversation isn’t saved in your history on this device yet.",
        });
      }
      router.replace("/(main)/(tabs)");
    })();

    return () => {
      cancelled = true;
    };
  }, [isSessionLoading, session, sessionId, openHistorySession, router]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top", "bottom", "left", "right"]}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
          gap: 16,
        }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <AppText muted style={{ textAlign: "center", fontSize: 14 }}>
          Opening chat…
        </AppText>
      </View>
    </SafeAreaView>
  );
}
