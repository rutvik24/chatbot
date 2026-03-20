import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useEffect } from "react";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import ErrorBoundary from "@/components/error-boundary";
import { AppText } from "@/components/common";
import ToastOverlay from "@/components/toast-overlay";
import { SessionProvider, useSession } from "@/ctx/auth-context";
import {
  ThemePreferenceProvider,
  useThemePreference,
} from "@/ctx/theme-preference-context";
import { useNativeThemeColors } from "@/hooks/use-native-theme-colors";

SplashScreen.preventAutoHideAsync();

function asHeaderColor(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <SessionProvider>
        <ErrorBoundary>
          <RootNavigator />
        </ErrorBoundary>
      </SessionProvider>
    </ThemePreferenceProvider>
  );
}

function RootNavigator() {
  useColorScheme();
  const { resolvedColorScheme } = useThemePreference();
  const colors = useNativeThemeColors();
  const headerBackground = asHeaderColor(
    colors.background,
    resolvedColorScheme === "dark" ? "#000000" : "#FFFFFF",
  );
  const headerText = asHeaderColor(
    colors.text,
    resolvedColorScheme === "dark" ? "#FFFFFF" : "#111827",
  );
  const compactHeaderStyle = {
    backgroundColor: headerBackground,
  };
  const { session, isLoading } = useSession();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return (
    <ThemeProvider
      value={resolvedColorScheme === "dark" ? DarkTheme : DefaultTheme}
    >
      <StatusBar
        style={resolvedColorScheme === "dark" ? "light" : "dark"}
      />
      <AnimatedSplashOverlay />
      <ToastOverlay />
      <Stack
        screenOptions={{
          headerShown: false,
          headerTitle: "",
          headerBackButtonDisplayMode: "minimal",
          headerStyle: compactHeaderStyle,
          headerTintColor: headerText,
          headerShadowVisible: false,
          header: ({ navigation }) => (
            <SafeAreaView
              edges={["top"]}
              style={[
                styles.headerSafeArea,
                { backgroundColor: headerBackground },
              ]}
            >
              <View style={styles.headerContent}>
                <Pressable
                  onPress={() => navigation.goBack()}
                  hitSlop={8}
                  style={styles.backButton}
                >
                  <SymbolView
                    name={{
                      ios: "chevron.left",
                      android: "arrow_back",
                      web: "arrow_back",
                    }}
                    size={10}
                    tintColor={headerText}
                  />
                  <AppText style={[styles.backText, { color: headerText }]}>
                    Back
                  </AppText>
                </Pressable>
              </View>
            </SafeAreaView>
          ),
        }}
      >
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="(auth)/change-password"
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="(auth)/settings-profile"
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="(auth)/settings-security"
            options={{ headerShown: true }}
          />
          <Stack.Screen
            name="(auth)/settings-ai"
            options={{ headerShown: true }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)/sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/sign-up" options={{ headerShown: true }} />
          <Stack.Screen
            name="(auth)/forgot-password"
            options={{ headerShown: true }}
          />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  headerSafeArea: {
    width: "100%",
  },
  headerContent: {
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 14,
    fontWeight: "500",
  },
});

