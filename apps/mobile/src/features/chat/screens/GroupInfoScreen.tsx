import { GROUP_NAME_MAX_LENGTH, type GroupMemberView } from "@pt/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import { Sheet } from "@/components/Sheet";
import {
  Button,
  Divider,
  ErrorState,
  Screen,
  Spinner,
  Txt,
} from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import {
  addOutcomeCounts,
  freePlaces,
  selectionToIds,
} from "@/lib/group-rules";
import {
  PhotoPermissionError,
  pickPhotos,
  toAvatarDataUrl,
} from "@/lib/photos";
import { qk } from "@/lib/query-keys";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { radius, space, useTheme } from "@/theme";

import {
  addGroupMembers,
  clearGroupAvatar,
  dissolveGroup,
  fetchGroupCandidates,
  fetchGroupInfo,
  leaveGroup,
  removeGroupMember,
  renameGroup,
  setGroupAvatar,
  setGroupManagersOnly,
  setGroupMuted,
} from "../api-manage";
import { MemberPicker } from "../components/MemberPicker";

// Group info: members with their label; for managers also rename, photo,
// managers-only, add and remove; mute and leave for members (not super
// admins); dissolve for a super admin.
export const GroupInfoScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const { state } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = Number(params.id);
  const [name, setName] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const info = useQuery({
    queryKey: qk.groupInfo(groupId),
    queryFn: () => fetchGroupInfo(groupId),
  });
  const candidates = useQuery({
    queryKey: qk.groupCandidates(groupId),
    queryFn: () => fetchGroupCandidates(groupId),
    enabled: addOpen,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: qk.groupInfo(groupId) });
    void queryClient.invalidateQueries({ queryKey: qk.groups });
  };
  const fail = (error: unknown) => Alert.alert(errorText(error));
  const leave = () => {
    void queryClient.invalidateQueries({ queryKey: qk.groups });
    router.dismissAll();
  };
  const rename = useMutation({
    mutationFn: (value: string) => renameGroup(groupId, value),
    onSuccess: refresh,
    onError: fail,
  });
  const managersOnly = useMutation({
    mutationFn: (value: boolean) => setGroupManagersOnly(groupId, value),
    onSuccess: refresh,
    onError: fail,
  });
  const mute = useMutation({
    mutationFn: (value: boolean) => setGroupMuted(groupId, value),
    onSuccess: refresh,
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (key: string) => removeGroupMember(groupId, key),
    onSuccess: refresh,
    onError: fail,
  });
  const add = useMutation({
    mutationFn: () => addGroupMembers(groupId, selectionToIds(selected)),
    onSuccess: (result) => {
      const { added, skipped } = addOutcomeCounts(result.results);

      setSelected(new Set());
      setAddOpen(false);
      refresh();
      if (skipped > 0) {
        Alert.alert(
          t("groupMgmt.addSkipped", { count: skipped }),
          added > 0 ? t("groupMgmt.added", { count: added }) : undefined,
        );
      }
    },
    onError: fail,
  });
  const photo = useMutation({
    mutationFn: async (action: "set" | "clear") => {
      if (action === "clear") {
        await clearGroupAvatar(groupId);
        return;
      }
      try {
        const [picked] = await pickPhotos(1);

        if (picked) {
          await setGroupAvatar(groupId, await toAvatarDataUrl(picked));
        }
      } catch (error) {
        if (error instanceof PhotoPermissionError) {
          throw new Error(t("composer.permissionDenied"));
        }
        throw error;
      }
    },
    onSuccess: refresh,
    onError: fail,
  });
  const leaveMutation = useMutation({
    mutationFn: () => leaveGroup(groupId),
    onSuccess: leave,
    onError: fail,
  });
  const dissolve = useMutation({
    mutationFn: () => dissolveGroup(groupId),
    onSuccess: leave,
    onError: fail,
  });

  if (info.isPending) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  }
  if (info.isError) {
    return (
      <Screen>
        <ErrorState
          message={errorText(info.error)}
          onRetry={() => void info.refetch()}
        />
      </Screen>
    );
  }
  const { group, viewer, members } = info.data;
  const canEdit = viewer.canManage && !group.dissolved;
  const room = freePlaces(members);
  const myKey =
    state.status === "signedIn"
      ? `${state.me.actor.kind === "admin" ? "admin" : "user"}:${state.me.actor.id}`
      : "";
  const confirmRemove = (member: GroupMemberView) =>
    confirmAction({
      title: t("groupMgmt.removeTitle", { name: member.name }),
      confirmLabel: t("groupMgmt.remove"),
      cancelLabel: t("common.cancel"),
      destructive: true,
      onConfirm: () => remove.mutate(member.key),
    });
  const typed = name ?? group.name;

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t("groupMgmt.infoTitle") }} />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", gap: space.sm }}>
          <Avatar name={group.name} uri={group.avatarUrl} size={96} />
          <Txt size={20} weight="700">
            {group.name}
          </Txt>
          {group.dissolved ? (
            <Txt tone="muted">{t("groupMgmt.dissolvedNote")}</Txt>
          ) : null}
          {group.managersOnly ? (
            <Txt tone="muted" size={13}>
              {t("groupMgmt.managersOnlyNote")}
            </Txt>
          ) : null}
          {canEdit ? (
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button
                label={t("groupMgmt.photoChange")}
                variant="secondary"
                loading={photo.isPending}
                onPress={() => photo.mutate("set")}
              />
              {group.avatarUrl ? (
                <Button
                  label={t("groupMgmt.photoRemove")}
                  variant="secondary"
                  disabled={photo.isPending}
                  onPress={() => photo.mutate("clear")}
                />
              ) : null}
            </View>
          ) : null}
        </View>

        {canEdit ? (
          <View style={{ gap: space.md }}>
            <Txt weight="600">{t("groupMgmt.manage")}</Txt>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <TextInput
                value={typed}
                onChangeText={setName}
                maxLength={GROUP_NAME_MAX_LENGTH}
                style={[
                  styles.input,
                  { color: theme.fg, borderColor: theme.line, flex: 1 },
                ]}
              />
              <Button
                label={t("common.save")}
                loading={rename.isPending}
                disabled={typed.trim() === "" || typed.trim() === group.name}
                onPress={() => rename.mutate(typed.trim())}
              />
            </View>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Txt>{t("groupMgmt.managersOnly")}</Txt>
                <Txt tone="muted" size={13}>
                  {t("groupMgmt.managersOnlyHint")}
                </Txt>
              </View>
              <Switch
                value={group.managersOnly}
                disabled={managersOnly.isPending}
                onValueChange={(value) => managersOnly.mutate(value)}
              />
            </View>
            <Button
              label={t("groupMgmt.addMembers")}
              variant="secondary"
              disabled={room === 0}
              onPress={() => setAddOpen(true)}
            />
          </View>
        ) : null}

        {!group.dissolved ? (
          <View style={styles.switchRow}>
            <Txt style={{ flex: 1 }}>{t("groupMgmt.mute")}</Txt>
            <Switch
              value={viewer.muted}
              disabled={mute.isPending}
              onValueChange={(value) => mute.mutate(value)}
            />
          </View>
        ) : null}
        <Divider />

        <Txt weight="600">
          {t("groupMgmt.members", { count: members.length })}
        </Txt>
        {members.map((member) => (
          <View key={member.key} style={styles.memberRow}>
            <Avatar name={member.name} uri={member.avatarUrl} size={40} />
            <View style={{ flex: 1 }}>
              <Txt numberOfLines={1}>
                {member.name}
                {member.key === myKey ? ` (${t("common.you")})` : ""}
              </Txt>
              <Txt tone="muted" size={12}>
                {t(`chatx.role.${member.role}`)}
                {member.isCreator ? ` · ${t("groupMgmt.creator")}` : ""}
              </Txt>
            </View>
            {canEdit &&
            member.role !== "super_admin" &&
            member.key !== myKey ? (
              <Button
                label={t("groupMgmt.remove")}
                variant="secondary"
                style={{ minHeight: 36, paddingHorizontal: space.md }}
                onPress={() => confirmRemove(member)}
              />
            ) : null}
          </View>
        ))}
        <Divider />

        {!group.dissolved && !viewer.isSuperAdmin ? (
          <Button
            label={t("groupMgmt.leave")}
            variant="danger"
            loading={leaveMutation.isPending}
            onPress={() =>
              confirmAction({
                title: t("groupMgmt.leaveTitle"),
                message: t("groupMgmt.leaveBody"),
                confirmLabel: t("groupMgmt.leave"),
                cancelLabel: t("common.cancel"),
                destructive: true,
                onConfirm: () => leaveMutation.mutate(),
              })
            }
          />
        ) : null}
        {viewer.isSuperAdmin && !group.dissolved ? (
          <Button
            label={t("groupMgmt.dissolve")}
            variant="danger"
            loading={dissolve.isPending}
            onPress={() =>
              confirmAction({
                title: t("groupMgmt.dissolveTitle"),
                message: t("groupMgmt.dissolveBody"),
                confirmLabel: t("groupMgmt.dissolve"),
                cancelLabel: t("common.cancel"),
                destructive: true,
                onConfirm: () => dissolve.mutate(),
              })
            }
          />
        ) : null}
      </ScrollView>

      <Sheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        title={t("groupMgmt.addMembers")}
      >
        {candidates.isPending ? (
          <Spinner />
        ) : candidates.isError ? (
          <ErrorState
            message={errorText(candidates.error)}
            onRetry={() => void candidates.refetch()}
          />
        ) : (
          <>
            <ScrollView
              style={{ maxHeight: 360 }}
              keyboardShouldPersistTaps="handled"
            >
              <MemberPicker
                candidates={candidates.data}
                selected={selected}
                onChange={setSelected}
                max={room}
              />
            </ScrollView>
            <View style={{ marginTop: space.md }}>
              <Button
                label={t("groupMgmt.addAction", { count: selected.size })}
                loading={add.isPending}
                disabled={selected.size === 0}
                onPress={() => add.mutate()}
              />
            </View>
          </>
        )}
      </Sheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 48,
  },
  memberRow: { flexDirection: "row", alignItems: "center", gap: space.md },
});
