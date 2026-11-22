import { Ionicons } from "@expo/vector-icons";
import { type Href, Tabs, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAdminActor } from "@/features/admin/use-admin";
import { useAuth } from "@/features/auth/auth-context";
import { useUnreadTotal } from "@/features/chat/hooks";
import { useTheme } from "@/theme";

// The shared default tab (the anchor); an admin is moved to the dashboard below.
export const unstable_settings = { anchor: "index" };

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const unread = useUnreadTotal();
  const { state } = useAuth();
  // Nutrition is a trainee feature; admins do not get the tab.
  const isTrainee =
    state.status === "signedIn" && state.me.actor.kind === "user";
  // Admins (PT / super admin) get their own tab set: dashboard and members
  // replace Workouts; every other tab is shared.
  const isAdmin = useAdminActor() !== null;
  const router = useRouter();
  const pathname = usePathname();

  // Admins start on the dashboard (only when opened at the root, so a push
  // deep link to another tab is kept).
  useEffect(() => {
    if (isAdmin && pathname === "/") {
      router.replace("/dashboard" as string as Href);
    }
    // Once, at the first render of the tabs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  return (
    <Tabs
      // Back returns to the tab you came from (the admin redirect replaces the
      // anchor, so an admin never goes "back" to the trainee feed).
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          href: isAdmin ? undefined : null,
          title: t("admin.tabs.dashboard"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          href: isAdmin ? undefined : null,
          title: t("admin.tabs.members"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="people-outline"
              color={color as string}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.feed"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="newspaper-outline"
              color={color as string}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t("tabs.messages"),
          tabBarBadge: unread > 0 ? (unread > 99 ? "99+" : unread) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.accent,
            color: theme.accentFg,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="chatbubbles-outline"
              color={color as string}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          href: isAdmin ? null : undefined,
          title: t("tabs.workouts"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="barbell-outline"
              color={color as string}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: t("tabs.nutrition"),
          href: isTrainee ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="nutrition-outline"
              color={color as string}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: t("tabs.me"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="person-circle-outline"
              color={color as string}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
