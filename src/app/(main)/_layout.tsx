import { Drawer } from "expo-router/drawer";

import MainDrawerContent from "@/components/main-drawer-content";
import { ChatActionsProvider } from "@/ctx/chat-actions-context";
import { useNativeThemeColors } from "@/hooks/use-native-theme-colors";
import { useColorScheme } from "react-native";

export default function MainDrawerLayout() {
  useColorScheme();
  const colors = useNativeThemeColors();

  return (
    <ChatActionsProvider>
      <Drawer
        screenOptions={{
          headerShown: false,
          drawerType: "front",
          drawerStyle: {
            backgroundColor: colors.background,
            width: 288,
          },
          overlayColor: "rgba(0,0,0,0.35)",
        }}
        drawerContent={(props) => <MainDrawerContent {...props} />}
      >
        <Drawer.Screen
          name="(tabs)"
          options={{
            title: "Chat",
          }}
        />
      </Drawer>
    </ChatActionsProvider>
  );
}
