import { SOCIAL_COMMENT_MAX_LENGTH, type SocialCommentResponse } from "@pt/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Href, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import { Sheet, SheetAction } from "@/components/Sheet";
import { EmptyState, ErrorState, Screen, Spinner, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { qk } from "@/lib/query-keys";
import { formatAge } from "@/lib/time";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { radius, space, useTheme } from "@/theme";

import { addComment, deleteComment, editComment } from "./api";
import { PostCard } from "./components/PostCard";
import { PostSkeleton } from "./components/PostList";
import { useComments, usePost } from "./hooks";

const CommentRow = ({
  comment,
  onMenu,
}: {
  comment: SocialCommentResponse;
  onMenu: (comment: SocialCommentResponse) => void;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const age = formatAge(comment.createdAt, new Date(), currentLocale(), {
    now: t("time.now"),
    minutes: t("time.minutes"),
    hours: t("time.hours"),
    days: t("time.days"),
  });

  return (
    <Pressable
      onLongPress={() => (comment.canEdit || comment.canDelete) && onMenu(comment)}
      style={styles.comment}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push(
            `/profile/${encodeURIComponent(`${comment.authorKind}:${comment.authorId}`)}` as string as Href,
          )
        }
      >
        <Avatar name={comment.authorName} uri={comment.authorAvatarUrl} size={32} />
      </Pressable>
      <View style={[styles.bubble, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <Txt weight="600" size={13}>
          {comment.authorName}
        </Txt>
        <Txt selectable>{comment.body}</Txt>
        <Txt tone="muted" size={11}>
          {age}
          {comment.edited ? ` · ${t("common.edited")}` : ""}
        </Txt>
      </View>
    </Pressable>
  );
};

export const PostScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);
  const post = usePost(postId);
  const comments = useComments(postId);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<SocialCommentResponse | null>(null);
  const [menu, setMenu] = useState<SocialCommentResponse | null>(null);

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: qk.comments(postId) });
    await queryClient.invalidateQueries({ queryKey: qk.post(postId) });
    await queryClient.invalidateQueries({ queryKey: qk.feed });
  };

  const send = useMutation({
    mutationFn: async (body: string) => {
      if (editing) {
        await editComment(editing.id, body);
      } else {
        await addComment(postId, body);
      }
    },
    onSuccess: async () => {
      setText("");
      setEditing(null);
      await refreshAll();
    },
    onError: (error) => Alert.alert(errorText(error)),
  });
  const remove = useMutation({
    mutationFn: (commentId: number) => deleteComment(commentId),
    onSuccess: refreshAll,
    onError: (error) => Alert.alert(errorText(error)),
  });

  const submit = () => {
    const body = text.trim();

    if (body !== "" && !send.isPending) {
      send.mutate(body);
    }
  };

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t("comments.title") }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        {post.isPending ? (
          <View style={{ padding: space.lg }}>
            <PostSkeleton />
          </View>
        ) : post.isError ? (
          <ErrorState message={errorText(post.error)} onRetry={() => void post.refetch()} />
        ) : (
          <FlatList
            data={comments.comments}
            keyExtractor={(comment) => String(comment.id)}
            contentContainerStyle={{ padding: space.lg, gap: space.md }}
            refreshControl={
              <RefreshControl
                refreshing={post.isRefetching}
                onRefresh={() => {
                  void post.refetch();
                  void comments.refetch();
                }}
              />
            }
            ListHeaderComponent={<PostCard post={post.data} detail />}
            renderItem={({ item }) => <CommentRow comment={item} onMenu={setMenu} />}
            onEndReached={() => {
              if (comments.hasNextPage && !comments.isFetchingNextPage) {
                void comments.fetchNextPage();
              }
            }}
            ListEmptyComponent={
              comments.isPending ? (
                <Spinner />
              ) : comments.isError ? (
                <ErrorState
                  message={errorText(comments.error)}
                  onRetry={() => void comments.refetch()}
                />
              ) : (
                <EmptyState icon="chatbubble-outline" title={t("comments.empty")} />
              )
            }
            keyboardShouldPersistTaps="handled"
          />
        )}
        {editing ? (
          <View style={[styles.editing, { backgroundColor: theme.surface }]}>
            <Txt size={13} tone="muted">
              {t("comments.edit")}
            </Txt>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEditing(null);
                setText("");
              }}
            >
              <Txt size={13} tone="accent">
                {t("common.cancel")}
              </Txt>
            </Pressable>
          </View>
        ) : null}
        <View style={[styles.inputRow, { borderTopColor: theme.line, backgroundColor: theme.surface }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t("comments.placeholder")}
            placeholderTextColor={theme.muted}
            maxLength={SOCIAL_COMMENT_MAX_LENGTH}
            multiline
            style={[styles.input, { color: theme.fg, borderColor: theme.line }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.send")}
            onPress={submit}
            disabled={text.trim() === "" || send.isPending}
            style={{ opacity: text.trim() === "" || send.isPending ? 0.4 : 1, padding: space.sm }}
          >
            <Txt tone="accent" weight="700">
              {t("common.send")}
            </Txt>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Sheet visible={menu !== null} onClose={() => setMenu(null)}>
        {menu?.canEdit ? (
          <SheetAction
            label={t("common.edit")}
            onPress={() => {
              setEditing(menu);
              setText(menu.body);
              setMenu(null);
            }}
          />
        ) : null}
        {menu?.canDelete ? (
          <SheetAction
            danger
            label={t("common.delete")}
            onPress={() => {
              const target = menu;

              setMenu(null);
              confirmAction({
                title: t("comments.deleteConfirm"),
                confirmLabel: t("common.delete"),
                cancelLabel: t("common.cancel"),
                destructive: true,
                onConfirm: () => remove.mutate(target.id),
              });
            }}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  comment: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  bubble: {
    flexShrink: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: 2,
  },
  editing: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    padding: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
  },
});
