import "@/i18n";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorState, Screen } from "@/components/ui";
import { AdminLockScreen, AdminLockWatcher } from "@/features/admin/screens/AdminLockScreen";
import { AuthProvider, useAuth } from "@/features/auth/auth-context";
import { PresenceHeartbeat } from "@/features/chat/presence";
import { RealtimeProvider } from "@/features/chat/realtime";
import { PushEffects } from "@/features/push/PushEffects";
import { useFontsReady } from "@/features/splash/use-app-ready";
import { isApiError } from "@/lib/errors";
import { useTheme } from "@/theme";

void SplashScreen.preventAutoHideAsync();
// Fade the native splash out instead of cutting to the app.
SplashScreen.setOptions({ duration: 350, fade: true });

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        retry: (count, error) =>
          count < 2 && !(isApiError(error) && error.isClientError),
      },
    },
  });

const Gate = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { state, retry } = useAuth();
  const signedIn = state.status === "signedIn";
  const locked = state.status === "signedIn" && state.me.actor.kind === "admin" && state.me.actor.locked;

  const fontsReady = useFontsReady();
  const ready = fontsReady && state.status !== "loading";

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  if (state.status === "unreachable") {
    return (
      <Screen>
        <ErrorState message={t("common.errorOffline")} onRetry={retry} />
      </Screen>
    );
  }
  // A PT with a passcode sees only the unlock screen until it is entered.
  if (locked) {
    return (
      <>
        <StatusBar style="auto" />
        <AdminLockScreen />
      </>
    );
  }
  return (
    <RealtimeProvider enabled={signedIn}>
      <AdminLockWatcher />
      <StatusBar style="auto" />
      {signedIn ? <PushEffects /> : null}
      {signedIn ? <PresenceHeartbeat /> : null}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.fg,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(trainee)" options={{ headerShown: false }} />
          <Stack.Screen name="admin" options={{ headerShown: false }} />
          <Stack.Screen name="compose" options={{ presentation: "modal" }} />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="profile/[key]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="friends" />
          <Stack.Screen name="blocked" />
          <Stack.Screen name="reports" />
          <Stack.Screen name="sessions" options={{ title: t("me.devices") }} />
          <Stack.Screen name="chat/coach" options={{ headerShown: false }} />
          <Stack.Screen name="chat/trainee/[userId]" options={{ headerShown: false }} />
          <Stack.Screen name="chat/group/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="chat/dm/[cid]" options={{ headerShown: false }} />
          <Stack.Screen name="chat/group-info/[id]" />
          <Stack.Screen name="chat/group-new" />
          <Stack.Screen name="chat/info" />
          <Stack.Screen name="chat/search" />
          <Stack.Screen name="chat/gallery" />
        </Stack.Protected>
      </Stack>
    </RealtimeProvider>
  );
};

export default function RootLayout() {
  const [queryClient] = useState(makeQueryClient);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Gate />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
