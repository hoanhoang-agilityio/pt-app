import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { useUnreadTotal } from "@/features/chat/hooks";
import { useTheme } from "@/theme";

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const unread = useUnreadTotal();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.line },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.feed"),
          tabBarIcon: ({ color, size }) => <Ionicons name="newspaper-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t("tabs.messages"),
          tabBarBadge: unread > 0 ? (unread > 99 ? "99+" : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.accent, color: theme.accentFg },
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: t("tabs.workouts"),
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: t("tabs.me"),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
