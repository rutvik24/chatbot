import { ThemeProvider } from "@react-navigation/native";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { Platform, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import ErrorBoundary from "@/components/error-boundary";
import NetworkStatusBanner from "@/components/network-status-banner";
import ToastOverlay from "@/components/toast-overlay";
import { SessionProvider, useSession } from "@/ctx/auth-context";
import { ChatHistoryProvider } from "@/ctx/chat-history-context";
import { NetworkStateProvider } from "@/ctx/network-state-context";
import {
  ThemePreferenceProvider,
  useThemePreference,
} from "@/ctx/theme-preference-context";
import { createAppNavigationTheme } from "@/utils/navigation-theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemePreferenceProvider>
        <NetworkStateProvider>
          <SessionProvider>
            <ChatHistoryProvider>
              <ErrorBoundary>
                <RootNavigator />
              </ErrorBoundary>
            </ChatHistoryProvider>
          </SessionProvider>
        </NetworkStateProvider>
      </ThemePreferenceProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  useColorScheme();
  const { resolvedColorScheme } = useThemePreference();
  const navigationTheme = useMemo(
    () => createAppNavigationTheme(resolvedColorScheme),
    [resolvedColorScheme],
  );
  const { session, isLoading } = useSession();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar
        style={resolvedColorScheme === "dark" ? "light" : "dark"}
      />
      <AnimatedSplashOverlay />
      <ToastOverlay />
      <NetworkStatusBanner />
      <Stack
        screenOptions={({ theme }) => ({
          headerShown: false,
          headerStyle: {
            backgroundColor: theme.colors.card,
          },
          headerTintColor: theme.colors.primary,
          headerTitleStyle: { color: theme.colors.text },
          headerLargeTitleStyle: { color: theme.colors.text },
          headerLargeStyle: {
            backgroundColor: theme.colors.card,
          },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
          /** Solid bar so theme background isn’t overridden by system blur. */
          headerBlurEffect:
            Platform.OS === "ios" ? ("none" as const) : undefined,
          /**
           * iOS: chevron + “Back” label when space allows (native behavior).
           * Android: default material back + previous route title when applicable.
           */
          headerBackButtonDisplayMode:
            Platform.OS === "ios" ? "generic" : "default",
          /**
           * Large titles are scroll-linked; short/centered ScrollViews often leave the
           * title blank until the user scrolls. Use a normal inline title everywhere.
           */
          headerLargeTitleEnabled: false,
        })}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(main)" options={{ headerShown: false }} />
          <Stack.Screen
            name="(auth)/change-password"
            options={{
              headerShown: true,
              title: "Change password",
            }}
          />
          <Stack.Screen
            name="(auth)/settings-profile"
            options={{
              headerShown: true,
              title: "Profile",
            }}
          />
          <Stack.Screen
            name="(auth)/settings-security"
            options={{
              headerShown: true,
              title: "Security",
            }}
          />
          <Stack.Screen
            name="(auth)/settings-ai"
            options={{
              headerShown: true,
              title: "AI settings",
            }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen
            name="(auth)/sign-in"
            options={{
              headerShown: true,
              title: "Sign in",
              /** Root of the logged-out stack — no back affordance. */
              headerBackVisible: false,
            }}
          />
          <Stack.Screen
            name="(auth)/sign-up"
            options={{
              headerShown: true,
              title: "Create account",
            }}
          />
          <Stack.Screen
            name="(auth)/forgot-password"
            options={{
              headerShown: true,
              title: "Forgot password",
            }}
          />
        </Stack.Protected>
        {/**
         * Deep link `chatapp://chat/<id>` — declared last so it is not the stack’s initial route.
         * Opens even when logged out; screen prompts sign-in or loads history when signed in.
         */}
        <Stack.Screen
          name="chat/[sessionId]"
          options={{ headerShown: false, animation: "fade" }}
        />
      </Stack>
    </ThemeProvider>
  );
}
