import type { SocialRelationship } from "@pt/contracts";
import { type Href, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Button, Txt } from "@/components/ui";
import { actionsFor, type RelationshipAction } from "@/lib/social-rules";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { space, useTheme } from "@/theme";

import { useRelationshipActions } from "../hooks";

// A person of the friends screens: tap opens the profile; `children` are the
// action buttons.
export const PersonRow = ({
  id,
  name,
  avatarUrl,
  children,
}: {
  id: number;
  name: string;
  avatarUrl: string | null;
  children?: ReactNode;
}) => {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.row, { borderBottomColor: theme.line }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/profile/user:${id}` as string as Href)}
        style={styles.who}
      >
        <Avatar name={name} uri={avatarUrl} size={44} />
        <Txt weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
          {name}
        </Txt>
      </Pressable>
      <View style={{ flexDirection: "row", gap: space.sm }}>{children}</View>
    </View>
  );
};

// The buttons a relationship allows, wired to the API; `compact` for rows.
export const RelationshipButtons = ({
  userId,
  name,
  relationship,
  compact = false,
}: {
  userId: number;
  name: string;
  relationship: SocialRelationship;
  compact?: boolean;
}) => {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const actions = useRelationshipActions();
  const run = (action: RelationshipAction) => {
    const mutation =
      action === "add"
        ? actions.add
        : action === "cancel"
          ? actions.cancel
          : action === "accept"
            ? actions.accept
            : action === "decline"
              ? actions.decline
              : actions.unfriend;
    const go = () =>
      mutation.mutate(userId, { onError: (error) => Alert.alert(errorText(error)) });

    if (action === "unfriend") {
      confirmAction({
        title: t("friends.unfriendConfirm", { name }),
        confirmLabel: t("friends.actions.unfriend"),
        cancelLabel: t("common.cancel"),
        destructive: true,
        onConfirm: go,
      });
    } else {
      go();
    }
  };
  const busy = Object.values(actions).some((m) => m.isPending);

  return (
    <>
      {actionsFor(relationship).map((action) => (
        <Button
          key={action}
          label={t(`friends.actions.${action}`)}
          variant={action === "add" || action === "accept" ? "primary" : "secondary"}
          disabled={busy}
          style={compact ? { minHeight: 38, paddingHorizontal: space.md } : undefined}
          onPress={() => run(action)}
        />
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  who: { flexDirection: "row", alignItems: "center", gap: space.md, flexShrink: 1 },
});
