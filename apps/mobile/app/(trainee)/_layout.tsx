import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/theme";

// Trainee screens pushed over the tabs: week summary, food library, password.
export default function TraineeLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

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
      <Stack.Screen name="summary" options={{ title: t("train.summary.title") }} />
      <Stack.Screen name="foods/index" options={{ title: t("nutri.library.title") }} />
      <Stack.Screen name="password" options={{ title: t("acct.password.title") }} />
    </Stack>
  );
}
