import { Ionicons } from "@expo/vector-icons";
import type { SocialPostResponse } from "@pt/contracts";
import { type Href, useRouter } from "expo-router";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { ReactionPicker } from "@/components/ReactionPicker";
import { Sheet, SheetAction } from "@/components/Sheet";
import { Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { isSingleEmoji } from "@/lib/emoji";
import { nextReaction, topReactions } from "@/lib/reactions";
import { formatAge } from "@/lib/time";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { radius, space, useTheme } from "@/theme";

import { ReportSheet } from "../../social/components/ReportSheet";
import { useDeletePost, useReact } from "../hooks";
import { PostPhotos } from "./PostPhotos";
import { ReactorsSheet } from "./ReactorsSheet";

export const profileKeyOf = (post: Pick<SocialPostResponse, "authorKind" | "authorId">) =>
  `${post.authorKind}:${post.authorId}`;

const PostCardBase = ({
  post,
  detail = false,
}: {
  post: SocialPostResponse;
  // The post page: no "open comments" link, the comments are right below.
  detail?: boolean;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const react = useReact(post.id);
  const remove = useDeletePost();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactorsOpen, setReactorsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const mine = post.reactions.mine;
  const age = formatAge(post.createdAt, new Date(), currentLocale(), {
    now: t("time.now"),
    minutes: t("time.minutes"),
    hours: t("time.hours"),
    days: t("time.days"),
  });

  const pick = (emoji: string) => {
    setPickerOpen(false);
    if (isSingleEmoji(emoji)) {
      react.mutate(nextReaction(mine, emoji));
    }
  };

  const openProfile = () =>
    router.push(`/profile/${encodeURIComponent(profileKeyOf(post))}` as string as Href);
  const openPost = () => router.push(`/post/${post.id}` as string as Href);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <View style={styles.header}>
        <Pressable onPress={openProfile} style={styles.author} accessibilityRole="button">
          <Avatar name={post.authorName} uri={post.authorAvatarUrl} size={40} />
          <View style={{ flexShrink: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Txt weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
                {post.authorName}
              </Txt>
              {post.authorVerified ? (
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={theme.accent}
                  accessibilityLabel={t("common.verified")}
                />
              ) : null}
            </View>
            <Txt tone="muted" size={12}>
              {age} · {t(`feed.privacy.${post.privacy}`)}
              {post.edited ? ` · ${t("common.edited")}` : ""}
            </Txt>
          </View>
        </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.more")}
            hitSlop={8}
            onPress={() => setMenuOpen(true)}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.muted} />
          </Pressable>
      </View>

      {post.caption ? (
        <Txt style={{ lineHeight: 21 }} selectable>
          {post.caption}
        </Txt>
      ) : null}
      <PostPhotos photos={post.photos} />

      {post.reactions.total > 0 || post.commentCount > 0 ? (
        <View style={styles.summary}>
          {post.reactions.total > 0 ? (
            <Pressable onPress={() => setReactorsOpen(true)} accessibilityRole="button">
              <Txt size={13} tone="muted">
                {topReactions(post.reactions).join("")} {post.reactions.total}
              </Txt>
            </Pressable>
          ) : (
            <View />
          )}
          {post.commentCount > 0 ? (
            <Pressable onPress={detail ? undefined : openPost} accessibilityRole="button">
              <Txt size={13} tone="muted">
                {t("feed.viewComments", { count: post.commentCount })}
              </Txt>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.actions, { borderTopColor: theme.line }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("feed.react")}
          onPress={() =>
            mine ? react.mutate(null) : setPickerOpen((open) => !open)
          }
          onLongPress={() => setPickerOpen((open) => !open)}
          style={styles.action}
        >
          {mine ? (
            <Txt size={20}>{mine}</Txt>
          ) : (
            <Ionicons name="happy-outline" size={22} color={theme.muted} />
          )}
          <Txt tone={mine ? "accent" : "muted"} size={13} weight="600">
            {t("feed.react")}
          </Txt>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("feed.comment")}
          onPress={openPost}
          style={styles.action}
        >
          <Ionicons name="chatbubble-outline" size={20} color={theme.muted} />
          <Txt tone="muted" size={13} weight="600">
            {t("feed.comment")}
          </Txt>
        </Pressable>
      </View>
      {pickerOpen ? <ReactionPicker mine={mine} onPick={pick} /> : null}
      {react.isError ? (
        <Txt tone="danger" size={12}>
          {errorText(react.error)}
        </Txt>
      ) : null}

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        {post.canEdit ? (
          <SheetAction
            label={t("feed.postMenu.edit")}
            onPress={() => {
              setMenuOpen(false);
              router.push(`/compose?postId=${post.id}` as string as Href);
            }}
          />
        ) : null}
        {post.canDelete ? (
          <SheetAction
            danger
            label={t("feed.postMenu.delete")}
            onPress={() => {
              setMenuOpen(false);
              confirmAction({
                title: t("feed.postMenu.deleteConfirm"),
                message: t("common.confirmDeleteBody"),
                confirmLabel: t("common.delete"),
                cancelLabel: t("common.cancel"),
                destructive: true,
                onConfirm: () =>
                  remove.mutate(post.id, {
                    onError: (error) => Alert.alert(errorText(error)),
                    onSuccess: () => {
                      if (detail) {
                        router.back();
                      }
                    },
                  }),
              });
            }}
          />
        ) : null}
        {!post.canEdit ? (
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
        targetKind="post"
        targetId={post.id}
      />
      <ReactorsSheet
        postId={post.id}
        visible={reactorsOpen}
        onClose={() => setReactorsOpen(false)}
      />
    </View>
  );
};

export const PostCard = memo(PostCardBase);

const styles = StyleSheet.create({
  card: {
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  author: { flexDirection: "row", alignItems: "center", gap: space.md, flexShrink: 1 },
  summary: { flexDirection: "row", justifyContent: "space-between" },
  actions: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.xs,
  },
  action: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
});
