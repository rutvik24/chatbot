import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppText from "@/components/common/app-text";
import { useNativeThemeColors } from "@/hooks/use-native-theme-colors";
import {
  resolveToastDuration,
  subscribeToast,
  type Toast,
  type ToastVariant,
} from "@/utils/toast-bus";

function toastSymbolName(variant: ToastVariant) {
  switch (variant) {
    case "error":
      return {
        ios: "exclamationmark.triangle.fill" as const,
        android: "error" as const,
        web: "error_outline" as const,
      };
    case "info":
      return {
        ios: "info.circle.fill" as const,
        android: "info" as const,
        web: "info" as const,
      };
    default:
      return {
        ios: "checkmark.circle.fill" as const,
        android: "check_circle" as const,
        web: "check_circle" as const,
      };
  }
}

function resolvedVariant(toast: Toast): ToastVariant {
  return toast.variant ?? "success";
}

/**
 * Global toast overlay.
 *
 * Listens to `showToast()` from `src/utils/toast-bus.ts` and shows a short,
 * animated banner above the tab bar — clear hierarchy, native symbols, and
 * tap-to-dismiss on the message area.
 */
export default function ToastOverlay() {
  useColorScheme();
  const colors = useNativeThemeColors();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animOpacity = useRef(new Animated.Value(0)).current;
  const animTranslate = useRef(new Animated.Value(18)).current;

  const dismissToast = useCallback(() => {
    animOpacity.stopAnimation();
    animTranslate.stopAnimation();
    Animated.parallel([
      Animated.timing(animOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(animTranslate, {
        toValue: 24,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }, [animOpacity, animTranslate]);

  useEffect(() => {
    const unsubscribe = subscribeToast((nextToast) => {
      animOpacity.stopAnimation();
      animTranslate.stopAnimation();
      animOpacity.setValue(0);
      animTranslate.setValue(18);

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      setToast(nextToast);

      const duration = resolveToastDuration(nextToast);
      toastTimerRef.current = setTimeout(() => {
        dismissToast();
      }, duration);
    });

    return () => {
      unsubscribe();
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [animOpacity, animTranslate, dismissToast]);

  useEffect(() => {
    if (!toast) return;
    Animated.parallel([
      Animated.timing(animOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.spring(animTranslate, {
        toValue: 0,
        stiffness: 280,
        damping: 24,
        mass: 0.85,
        useNativeDriver: true,
      }),
    ]).start();
  }, [toast, animOpacity, animTranslate]);

  const variant = toast ? resolvedVariant(toast) : "success";

  const accent = useMemo(() => {
    switch (variant) {
      case "error":
        return colors.error;
      case "info":
        return colors.primary;
      default:
        return colors.success;
    }
  }, [variant, colors.error, colors.primary, colors.success]);

  const iconBadgeBg = useMemo(() => {
    switch (variant) {
      case "error":
        return Platform.select({
          ios: "rgba(255, 59, 48, 0.12)",
          default: "rgba(220, 38, 38, 0.14)",
        });
      case "info":
        return Platform.select({
          ios: "rgba(10, 132, 255, 0.12)",
          default: "rgba(37, 99, 235, 0.12)",
        });
      default:
        return Platform.select({
          ios: "rgba(52, 199, 89, 0.14)",
          default: "rgba(22, 163, 74, 0.12)",
        });
    }
  }, [variant]);

  if (!toast) return null;

  const bottomOffset = Math.max(insets.bottom, 12) + 56;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.toastWrap, { bottom: bottomOffset }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      accessibilityLabel={
        toast.title
          ? `${toast.title}. ${toast.message}`
          : toast.message
      }>
      <Animated.View
        style={[
          styles.toastCard,
          {
            opacity: animOpacity,
            transform: [{ translateY: animTranslate }],
            backgroundColor: colors.surface,
            borderColor: colors.border,
            ...Platform.select({
              ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.14,
                shadowRadius: 24,
              },
              android: {
                elevation: 10,
              },
              default: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.12,
                shadowRadius: 16,
              },
            }),
          },
        ]}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />

        <Pressable
          onPress={dismissToast}
          style={styles.messagePressable}
          accessibilityRole="button"
          accessibilityHint="Dismisses this notice">
          <View style={[styles.iconBadge, { backgroundColor: iconBadgeBg }]}>
            <SymbolView
              name={toastSymbolName(variant)}
              size={26}
              tintColor={accent}
              style={styles.symbol}
            />
          </View>

          <View style={styles.textBlock}>
            {toast.title ? (
              <AppText
                style={[styles.title, { color: colors.text }]}
                maxFontSizeMultiplier={1.35}>
                {toast.title}
              </AppText>
            ) : null}
            <AppText
              style={[
                toast.title ? styles.subtitle : styles.messageOnly,
                { color: toast.title ? colors.secondaryText : colors.text },
              ]}
              maxFontSizeMultiplier={1.4}>
              {toast.message}
            </AppText>
          </View>
        </Pressable>

        {toast.action ? (
          <Pressable
            onPress={() => {
              toast.action?.onPress();
              dismissToast();
            }}
            style={({ pressed }) => [
              styles.actionPill,
              { borderColor: accent, opacity: pressed ? 0.82 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={toast.action.label}>
            <AppText
              style={[styles.actionLabel, { color: accent }]}
              maxFontSizeMultiplier={1.25}>
              {toast.action.label}
            </AppText>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: "center",
  },
  toastCard: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 400,
    width: "100%",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 0,
  },
  accentBar: {
    alignSelf: "stretch",
    width: 4,
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
  },
  messagePressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 8,
    minHeight: 48,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  symbol: {
    width: 28,
    height: 28,
  },
  textBlock: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  messageOnly: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
    letterSpacing: -0.15,
  },
  actionPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    marginLeft: 4,
    backgroundColor: "transparent",
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
});
