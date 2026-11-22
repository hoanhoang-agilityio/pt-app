import { Redirect, Stack } from "expo-router";

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
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="dm/[cid]" options={{ headerShown: false }} />
    </Stack>
  );
}
