import { GROUP_MEMBER_CAP, GROUP_NAME_MAX_LENGTH } from "@pt/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, Stack, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, StyleSheet, TextInput } from "react-native";

import { Button, ErrorState, Screen, Spinner } from "@/components/ui";
import { addOutcomeCounts, selectionToIds } from "@/lib/group-rules";
import { qk } from "@/lib/query-keys";
import { useErrorText } from "@/lib/ui-helpers";
import { radius, space, useTheme } from "@/theme";

import { createGroup, fetchGroupCandidates } from "../api-manage";
import { MemberPicker } from "../components/MemberPicker";

// New group (PT and super admin): a name and the first members.
export const CreateGroupScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const candidates = useQuery({
    queryKey: qk.groupCandidates(null),
    queryFn: () => fetchGroupCandidates(null),
  });
  const create = useMutation({
    mutationFn: () =>
      createGroup({ name: name.trim(), ...selectionToIds(selected) }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: qk.groups });
      const { skipped } = addOutcomeCounts(result.results);

      if (skipped > 0) {
        Alert.alert(t("groupMgmt.addSkipped", { count: skipped }));
      }
      router.replace(`/chat/group/${result.groupId}` as string as Href);
    },
    onError: (error) => Alert.alert(errorText(error)),
  });

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t("groupMgmt.createTitle") }} />
      {candidates.isPending ? (
        <Spinner />
      ) : candidates.isError ? (
        <ErrorState
          message={errorText(candidates.error)}
          onRetry={() => void candidates.refetch()}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.md }}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={GROUP_NAME_MAX_LENGTH}
            placeholder={t("groupMgmt.namePlaceholder")}
            placeholderTextColor={theme.muted}
            style={[styles.input, { color: theme.fg, borderColor: theme.line }]}
          />
          <MemberPicker
            candidates={candidates.data}
            selected={selected}
            onChange={setSelected}
            max={GROUP_MEMBER_CAP}
          />
          <Button
            label={t("groupMgmt.create")}
            loading={create.isPending}
            disabled={name.trim() === ""}
            onPress={() => create.mutate()}
          />
        </ScrollView>
      )}
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
});
