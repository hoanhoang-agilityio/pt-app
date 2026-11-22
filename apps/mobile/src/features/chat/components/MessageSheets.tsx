import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Sheet } from "@/components/Sheet";
import { ErrorState, Spinner, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { qk } from "@/lib/query-keys";
import { formatClock, formatDate } from "@/lib/time";
import { useErrorText } from "@/lib/ui-helpers";
import { space } from "@/theme";

import {
  fetchCoachEdits,
  fetchGroupEdits,
  fetchGroupSeenBy,
  fetchOriginal,
  originalPath,
} from "../api-manage";

export type MessageScope =
  { kind: "coach" } | { kind: "dm" } | { kind: "group"; groupId: number };

const scopeKey = (scope: MessageScope) =>
  scope.kind === "group" ? `group:${scope.groupId}` : scope.kind;

const stamp = (iso: string) => {
  const date = new Date(iso);

  return `${formatDate(date, currentLocale())} ${formatClock(date)}`;
};

// "Edited" history: every previous text of a message, newest first.
export const EditsSheet = ({
  scope,
  messageId,
  onClose,
}: {
  scope: MessageScope;
  messageId: number | null;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const query = useQuery({
    queryKey: qk.edits(scopeKey(scope), messageId ?? 0),
    queryFn: async () => {
      if (scope.kind === "group") {
        return (await fetchGroupEdits(scope.groupId, messageId ?? 0)).edits;
      }
      return (await fetchCoachEdits(messageId ?? 0)).edits;
    },
    enabled: messageId !== null && scope.kind !== "dm",
  });

  return (
    <Sheet
      visible={messageId !== null}
      onClose={onClose}
      title={t("chatx.editHistory")}
    >
      {query.isPending ? (
        <Spinner />
      ) : query.isError ? (
        <ErrorState
          message={errorText(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : query.data.length === 0 ? (
        <Txt tone="muted">{t("chatx.editHistoryEmpty")}</Txt>
      ) : (
        <ScrollView style={{ maxHeight: 380 }}>
          {[...query.data].reverse().map((edit, index) => (
            <View key={index} style={{ paddingVertical: space.sm, gap: 2 }}>
              <Txt tone="muted" size={12}>
                {stamp(edit.editedAt)}
              </Txt>
              <Txt selectable>{edit.previousBody}</Txt>
            </View>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
};

// Who read up to a group message.
export const SeenBySheet = ({
  groupId,
  messageId,
  onClose,
}: {
  groupId: number;
  messageId: number | null;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const query = useQuery({
    queryKey: qk.seenBy(groupId, messageId ?? 0),
    queryFn: () => fetchGroupSeenBy(groupId, messageId ?? 0),
    enabled: messageId !== null,
  });

  return (
    <Sheet
      visible={messageId !== null}
      onClose={onClose}
      title={t("chatx.seenByTitle")}
    >
      {query.isPending ? (
        <Spinner />
      ) : query.isError ? (
        <ErrorState
          message={errorText(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : query.data.seenBy.length === 0 ? (
        <Txt tone="muted">{t("chatx.seenByEmpty")}</Txt>
      ) : (
        <ScrollView style={{ maxHeight: 360 }}>
          {query.data.seenBy.map((person) => (
            <View
              key={person.key}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                minHeight: 44,
                alignItems: "center",
              }}
            >
              <Txt>{person.name}</Txt>
              <Txt tone="muted" size={12}>
                {t(`chatx.role.${person.role}`)}
              </Txt>
            </View>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
};

// Super admin only: the text of an unsent message. The route comes from a
// parallel API change; a 404 reads as "not available".
export const OriginalSheet = ({
  scope,
  messageId,
  onClose,
}: {
  scope: MessageScope;
  messageId: number | null;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const query = useQuery({
    queryKey: qk.original(scopeKey(scope), messageId ?? 0),
    queryFn: () => fetchOriginal(scope, messageId ?? 0),
    enabled: messageId !== null,
    retry: false,
  });

  return (
    <Sheet
      visible={messageId !== null}
      onClose={onClose}
      title={t("chatx.originalTitle")}
    >
      {query.isPending ? (
        <Spinner />
      ) : query.isError ? (
        <ErrorState
          message={errorText(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : query.data.body === "" ? (
        <Txt tone="muted">{t("chatx.originalEmpty")}</Txt>
      ) : (
        <Txt selectable>{query.data.body}</Txt>
      )}
    </Sheet>
  );
};

export { originalPath };
