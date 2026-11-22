import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView } from "react-native";

import { Button, EmptyState, ErrorState, Screen, Spinner } from "@/components/ui";
import { useErrorText } from "@/lib/ui-helpers";
import { space } from "@/theme";

import { PersonRow } from "./components/PersonRow";
import { useBlocks, useIsTrainee, useRelationshipActions } from "./hooks";

// People I blocked, with "unblock" (trainees only).
export const BlockedScreen = () => {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const isTrainee = useIsTrainee();
  const blocks = useBlocks();
  const actions = useRelationshipActions();

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t("blocks.title") }} />
      {!isTrainee ? (
        <EmptyState icon="ban-outline" title={t("friends.traineesOnly")} />
      ) : blocks.isPending ? (
        <Spinner />
      ) : blocks.isError ? (
        <ErrorState message={errorText(blocks.error)} onRetry={() => void blocks.refetch()} />
      ) : blocks.data.items.length === 0 ? (
        <EmptyState icon="ban-outline" title={t("blocks.empty")} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: space.xl }}>
          {blocks.data.items.map((person) => (
            <PersonRow key={person.id} {...person}>
              <Button
                label={t("blocks.unblock")}
                variant="secondary"
                disabled={actions.unblock.isPending}
                style={{ minHeight: 38, paddingHorizontal: space.md }}
                onPress={() =>
                  actions.unblock.mutate(person.id, {
                    onError: (error) => Alert.alert(errorText(error)),
                  })
                }
              />
            </PersonRow>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
};
