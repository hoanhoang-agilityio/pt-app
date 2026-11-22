import { CHAT_SEARCH_MAX_LENGTH, CHAT_SEARCH_MIN_LENGTH } from "@pt/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";

import { EmptyState, ErrorState, IconButton, Screen, Spinner, Txt } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { currentLocale } from "@/i18n";
import { buildRows, fromCoachMessage, mergeMessages } from "@/lib/chat-model";
import { qk } from "@/lib/query-keys";
import { formatClock, formatDate } from "@/lib/time";
import { useErrorText } from "@/lib/ui-helpers";
import { radius, space, useTheme } from "@/theme";

import { type CoachScope, fetchAround, searchConversation } from "../api-manage";
import { MessageBubble } from "../components/MessageBubble";

// Search inside a coach conversation (at least two characters). A result opens
// the messages around it, read-only.
export const ChatSearchScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const { state } = useAuth();
  const params = useLocalSearchParams<{ cid: string }>();
  const scope: CoachScope = params.cid === "me" ? "me" : Number(params.cid);
  const adminId = state.status === "signedIn" && state.me.actor.kind === "admin" ? state.me.actor.id : 0;
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [around, setAround] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 350);

    return () => clearTimeout(timer);
  }, [text]);

  const ready = Array.from(q).length >= CHAT_SEARCH_MIN_LENGTH;
  const results = useInfiniteQuery({
    queryKey: qk.chatSearch(String(scope), q),
    queryFn: ({ pageParam }) => searchConversation(scope, q, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: ready,
  });
  const items = results.data?.pages.flatMap((page) => page.results) ?? [];
  const context = useQuery({
    queryKey: ["chat", "around", String(scope), around],
    queryFn: () => fetchAround(scope, around ?? 0),
    enabled: around !== null,
  });
  const rows = useMemo(() => {
    if (!context.data) {
      return [];
    }
    const viewer = state.status === "signedIn" && state.me.actor.kind === "admin"
      ? ({ kind: "admin", adminId } as const)
      : ({ kind: "trainee" } as const);

    return buildRows(
      mergeMessages(
        [],
        context.data.messages.map((m) => fromCoachMessage(m, viewer, context.data.profile.colors)),
      ),
    ).reverse();
  }, [context.data, state, adminId]);

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t("chatSearch.title") }} />
      <View style={{ padding: space.lg }}>
        <TextInput
          value={text}
          onChangeText={setText}
          maxLength={CHAT_SEARCH_MAX_LENGTH}
          autoFocus
          returnKeyType="search"
          placeholder={t("chatSearch.placeholder")}
          placeholderTextColor={theme.muted}
          style={[styles.input, { color: theme.fg, borderColor: theme.line }]}
        />
      </View>
      {!ready ? (
        <EmptyState icon="search-outline" title={t("chatSearch.hint", { count: CHAT_SEARCH_MIN_LENGTH })} />
      ) : results.isPending ? (
        <Spinner />
      ) : results.isError ? (
        <ErrorState message={errorText(results.error)} onRetry={() => void results.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.messageId)}
          keyboardShouldPersistTaps="handled"
          onEndReached={() => {
            if (results.hasNextPage && !results.isFetchingNextPage) {
              void results.fetchNextPage();
            }
          }}
          ListEmptyComponent={<EmptyState icon="search-outline" title={t("chatSearch.empty")} />}
          contentContainerStyle={{ flexGrow: 1 }}
          renderItem={({ item }) => {
            const date = new Date(item.createdAt);

            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => setAround(item.messageId)}
                style={[styles.result, { borderBottomColor: theme.line }]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Txt weight="600" size={13}>
                    {item.senderName ?? t("chatSearch.unknownSender")}
                  </Txt>
                  <Txt tone="muted" size={12}>
                    {formatDate(date, currentLocale())} {formatClock(date)}
                  </Txt>
                </View>
                <Txt numberOfLines={2}>
                  {item.snippet.before}
                  <Txt weight="700" tone="accent">
                    {item.snippet.match}
                  </Txt>
                  {item.snippet.after}
                </Txt>
              </Pressable>
            );
          }}
        />
      )}
      <Modal visible={around !== null} animationType="slide" onRequestClose={() => setAround(null)}>
        <Screen>
          <View style={styles.modalHeader}>
            <IconButton name="close" label={t("common.close")} onPress={() => setAround(null)} />
            <Txt weight="600">{t("chatSearch.context")}</Txt>
          </View>
          {context.isPending ? (
            <Spinner />
          ) : context.isError ? (
            <ErrorState message={errorText(context.error)} onRetry={() => void context.refetch()} />
          ) : (
            <FlatList
              inverted
              data={rows}
              keyExtractor={(row) => row.key}
              contentContainerStyle={{ paddingVertical: space.sm }}
              renderItem={({ item }) =>
                item.type === "day" ? (
                  <Txt tone="muted" size={12} style={{ textAlign: "center", marginVertical: space.md }}>
                    {formatDate(new Date(item.at), currentLocale())}
                  </Txt>
                ) : (
                  <View
                    style={[
                      { paddingHorizontal: space.md },
                      item.message.id === around && { backgroundColor: theme.surface },
                    ]}
                  >
                    <MessageBubble
                      row={item}
                      color={{ bg: theme.accent, fg: theme.accentFg }}
                      showSender={false}
                      seenLabel={null}
                      onLongPress={() => undefined}
                      onOpenPhoto={() => undefined}
                      onRetry={() => undefined}
                    />
                  </View>
                )
              }
            />
          )}
        </Screen>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  input: { minHeight: 46, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.lg, fontSize: 16 },
  result: { padding: space.lg, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.sm },
});
