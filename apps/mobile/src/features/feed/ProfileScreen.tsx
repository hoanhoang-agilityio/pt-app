import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, TextInput, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Sheet, SheetAction } from "@/components/Sheet";
import { Button, ErrorState, Screen, Skeleton, Txt } from "@/components/ui";
import { isApiError } from "@/lib/errors";
import { qk } from "@/lib/query-keys";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { space, useTheme } from "@/theme";

import { saveBio } from "../social/api";
import { AliasSheet } from "../social/components/AliasSheet";
import { RelationshipButtons } from "../social/components/PersonRow";
import { ReportSheet } from "../social/components/ReportSheet";
import { useRelationshipActions } from "../social/hooks";
import { PostList } from "./components/PostList";
import { useProfile, useProfilePosts } from "./hooks";

const Stat = ({ value, label }: { value: number; label: string }) => (
  <View style={{ alignItems: "center", flex: 1 }}>
    <Txt size={20} weight="700">
      {value}
    </Txt>
    <Txt tone="muted" size={12}>
      {label}
    </Txt>
  </View>
);

// Profile of `user:<id>` / `admin:<id>` with their posts (the API filters what
// the viewer may see).
export const ProfileScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const { key: rawKey } = useLocalSearchParams<{ key: string }>();
  const key = decodeURIComponent(String(rawKey));
  const profile = useProfile(key);
  const posts = useProfilePosts(key);
  const queryClient = useQueryClient();
  const actions = useRelationshipActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [aliasOpen, setAliasOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");
  const [savingBio, setSavingBio] = useState(false);

  if (profile.isError) {
    const missing = isApiError(profile.error) && profile.error.status === 404;

    return (
      <Screen edges={["bottom"]}>
        <Stack.Screen options={{ title: t("profile.title") }} />
        <ErrorState
          message={missing ? t("profile.notFound") : errorText(profile.error)}
          onRetry={missing ? undefined : () => void profile.refetch()}
        />
      </Screen>
    );
  }
  const data = profile.data;

  const header = data ? (
    <View style={{ alignItems: "center", gap: space.sm, paddingBottom: space.lg }}>
      <Avatar name={data.name} uri={data.avatarUrl} size={88} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Txt size={22} weight="700">
          {data.name}
        </Txt>
        {data.verified ? (
          <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
        ) : null}
      </View>
      <Txt tone="muted" size={13}>
        {t(`profile.role.${data.role}`)}
        {data.friendCount !== null ? ` · ${t("profile.friends", { count: data.friendCount })}` : ""}
      </Txt>
      {data.alias ? (
        <Txt tone="muted" size={13}>
          {t("alias.realName", { name: data.realName })}
        </Txt>
      ) : null}
      {editingBio ? (
        <View style={{ alignSelf: "stretch", gap: space.sm }}>
          <TextInput
            value={bioText}
            onChangeText={setBioText}
            maxLength={150}
            multiline
            placeholder={t("profile.noBio")}
            placeholderTextColor={theme.muted}
            style={{ color: theme.fg, borderColor: theme.line, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 70 }}
          />
          <Button
            label={t("common.save")}
            loading={savingBio}
            onPress={() => {
              setSavingBio(true);
              saveBio(bioText.trim())
                .then(() => {
                  setEditingBio(false);
                  void queryClient.invalidateQueries({ queryKey: qk.profile(key) });
                })
                .catch((error: unknown) => Alert.alert(errorText(error)))
                .finally(() => setSavingBio(false));
            }}
          />
        </View>
      ) : (
        <Txt tone={data.bio ? "default" : "muted"} style={{ textAlign: "center" }}>
          {data.bio || t("profile.noBio")}
        </Txt>
      )}
      {data.isOwn && !editingBio ? (
        <Button
          label={t("profileExtra.editBio")}
          variant="ghost"
          onPress={() => {
            setBioText(data.bio);
            setEditingBio(true);
          }}
        />
      ) : null}
      {!data.isOwn ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, justifyContent: "center" }}>
          {data.relationship && data.kind === "user" ? (
            <RelationshipButtons userId={data.id} name={data.name} relationship={data.relationship} />
          ) : null}
          <Button label={data.alias ? t("alias.edit") : t("alias.set")} variant="secondary" onPress={() => setAliasOpen(true)} />
          {data.canBlock || data.canReport ? (
            <Button label={t("common.more")} variant="secondary" onPress={() => setMenuOpen(true)} />
          ) : null}
        </View>
      ) : null}
      {data.stats ? (
        <View style={{ flexDirection: "row", alignSelf: "stretch", paddingTop: space.sm }}>
          <Stat value={data.stats.workouts} label={t("profile.workouts")} />
          <Stat value={data.stats.streak} label={t("profile.streak")} />
          <Stat value={data.stats.totalSets} label={t("profile.sets")} />
        </View>
      ) : null}
    </View>
  ) : (
    <View style={{ alignItems: "center", gap: space.sm, paddingBottom: space.lg }}>
      <Skeleton width={88} height={88} round />
      <Skeleton width={140} height={18} />
      <Skeleton width={200} height={12} />
    </View>
  );

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: data?.name ?? t("profile.title") }} />
      <PostList
        header={header}
        posts={posts.posts}
        isPending={posts.isPending}
        isError={posts.isError}
        error={posts.error}
        isRefetching={posts.isRefetching}
        hasNextPage={posts.hasNextPage}
        isFetchingNextPage={posts.isFetchingNextPage}
        onRefresh={() => {
          void posts.refetch();
          void profile.refetch();
        }}
        onEndReached={() => void posts.fetchNextPage()}
        emptyTitle={t("profile.postsEmpty")}
        errorText={errorText}
      />
      {data ? (
        <>
          <AliasSheet
            visible={aliasOpen}
            onClose={() => setAliasOpen(false)}
            targetKey={`${data.kind}:${data.id}`}
            realName={data.realName}
            current={data.alias}
          />
          <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
            {data.canBlock ? (
              <SheetAction
                danger
                label={t("blocks.block")}
                onPress={() => {
                  setMenuOpen(false);
                  confirmAction({
                    title: t("blocks.blockConfirm", { name: data.name }),
                    message: t("blocks.blockBody"),
                    confirmLabel: t("blocks.block"),
                    cancelLabel: t("common.cancel"),
                    destructive: true,
                    onConfirm: () =>
                      actions.block.mutate(data.id, { onError: (error) => Alert.alert(errorText(error)) }),
                  });
                }}
              />
            ) : null}
            {data.canReport ? (
              <SheetAction
                label={t("report.action")}
                onPress={() => {
                  setMenuOpen(false);
                  setReportOpen(true);
                }}
              />
            ) : null}
          </Sheet>
          <ReportSheet
            visible={reportOpen}
            onClose={() => setReportOpen(false)}
            targetKind="user"
            targetId={data.id}
          />
        </>
      ) : null}
    </Screen>
  );
};
