import { Redirect } from "expo-router";

import { useSession } from "@/ctx/auth-context";

/**
 * Default entry `/` — avoids treating `chat/[sessionId]` as the initial stack screen
 * (which briefly showed “Opening chat…” on every cold start).
 */
export default function RootIndex() {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return null;
  }

  if (session) {
    return <Redirect href="/(main)/(tabs)" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}
