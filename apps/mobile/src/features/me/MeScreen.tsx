import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Button, Divider, Screen, Txt } from "@/components/ui";
import { APP_LOCALES, type AppLocale, currentLocale } from "@/i18n";
import { APP_VERSION } from "@/lib/config";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { radius, space, useTheme } from "@/theme";

import { useAuth } from "../auth/auth-context";
import { ProfileAvatar, TraineeProfileSection } from "./TraineeProfileSection";

export const MeScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const { state, signOut, changeLocale } = useAuth();
  const [busy, setBusy] = useState(false);

  if (state.status !== "signedIn") {
    return <Screen>{null}</Screen>;
  }
  const actor = state.me.actor;
  const name = actor.kind === "admin" ? actor.username : actor.name;
  const roleLabel =
    actor.kind === "admin"
      ? t(actor.role === "super_admin" ? "me.role.super_admin" : "me.role.pt")
      : t("me.role.trainee");
  const locale = currentLocale();

  const pickLocale = async (next: AppLocale) => {
    if (next === locale || busy) {
      return;
    }
    setBusy(true);
    try {
      await changeLocale(next);
    } catch (error) {
      Alert.alert(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const logout = () =>
    confirmAction({
      title: t("me.logoutConfirm"),
      confirmLabel: t("me.logout"),
      cancelLabel: t("common.cancel"),
      destructive: true,
      onConfirm: () => void signOut(),
    });

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={styles.header}>
          {actor.kind === "user" ? <ProfileAvatar name={name} /> : <Avatar name={name} size={72} />}
          <Txt size={20} weight="700">
            {name}
          </Txt>
          <Txt tone="muted">{roleLabel}</Txt>
        </View>

        {actor.kind === "user" ? <TraineeProfileSection /> : null}

        <View style={{ gap: space.sm }}>
          <Txt weight="600">{t("me.language")}</Txt>
          <View style={[styles.segment, { backgroundColor: theme.line }]}>
            {APP_LOCALES.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: locale === value }}
                disabled={busy}
                onPress={() => void pickLocale(value)}
                style={[styles.segmentItem, locale === value && { backgroundColor: theme.surface }]}
              >
                <Txt size={14} weight="600" tone={locale === value ? "default" : "muted"}>
                  {t(`locales.${value}`)}
                </Txt>
              </Pressable>
            ))}
          </View>
        </View>

        <Divider />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/sessions" as string as Href)}
          style={styles.link}
        >
          <Ionicons name="phone-portrait-outline" size={22} color={theme.accent} />
          <Txt style={{ flex: 1 }}>{t("me.devices")}</Txt>
          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
        </Pressable>
        <Divider />

        <Button label={t("me.logout")} variant="danger" onPress={logout} />
        <Txt tone="muted" size={12} style={{ textAlign: "center" }}>
          {t("me.version", { version: APP_VERSION })}
        </Txt>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: space.sm, paddingVertical: space.lg },
  segment: { flexDirection: "row", borderRadius: radius.md, padding: 3 },
  segmentItem: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  link: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 },
});
