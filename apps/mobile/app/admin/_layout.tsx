import { Redirect, Stack } from "expo-router";

import { NestedBackButton } from "@/components/NestedBackButton";
import { useAdminActor } from "@/features/admin/use-admin";
import { useTheme } from "@/theme";

// Admin (PT / super admin) stack screens; a trainee is sent back to the tabs.
export default function AdminLayout() {
  const theme = useTheme();
  const admin = useAdminActor();

  if (!admin) {
    return <Redirect href="/" />;
  }
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.fg,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        // First screen of this nested stack: no native back, so add one.
        headerLeft: ({ canGoBack }) =>
          canGoBack ? undefined : <NestedBackButton fallback="/members" />,
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="dm/[cid]" options={{ headerShown: false }} />
    </Stack>
  );
}
