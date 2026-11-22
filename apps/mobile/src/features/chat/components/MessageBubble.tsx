import type { GroupSystemEvent } from "@pt/contracts";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

import { AuthImage } from "@/components/AuthImage";
import { Txt } from "@/components/ui";
import type { ChatMsg, ThreadRow } from "@/lib/chat-model";
import { formatClock } from "@/lib/time";
import { radius, space, useTheme } from "@/theme";

const PHOTO_MAX = 240;

// "user:3" -> shown name; a deleted account has a null name.
export const systemLine = (
  event: GroupSystemEvent | null,
  names: Record<string, string | null>,
  t: (key: string, options?: Record<string, unknown>) => string,
) => {
  const name = (key: string) => names[key] ?? t("chat.group.system.deletedMember");

  if (!event) {
    return t("chat.group.system.unknown");
  }
  switch (event.type) {
    case "member_added":
      return t("chat.group.system.member_added", {
        actor: name(event.actorKey),
        members: event.memberKeys.map(name).join(", "),
      });
    case "member_removed":
      return t("chat.group.system.member_removed", {
        actor: name(event.actorKey),
        member: name(event.memberKey),
      });
    case "member_left":
      return t("chat.group.system.member_left", { member: name(event.memberKey) });
    case "renamed":
      return t("chat.group.system.renamed", { actor: name(event.actorKey), to: event.to });
    case "avatar_changed":
      return t("chat.group.system.avatar_changed", { actor: name(event.actorKey) });
    case "managers_only":
      return t(
        event.enabled
          ? "chat.group.system.managers_only_on"
          : "chat.group.system.managers_only_off",
        { actor: name(event.actorKey) },
      );
    case "pt_changed":
      return t("chat.group.system.pt_changed");
  }
};

const Photos = ({
  photos,
  onOpen,
}: {
  photos: ChatMsg["photos"];
  onOpen: (url: string) => void;
}) => {
  const single = photos.length === 1;
  const cell = single ? PHOTO_MAX : (PHOTO_MAX - 4) / 2;

  return (
    <View style={styles.photos}>
      {photos.map((photo, index) => {
        const ratio = photo.height > 0 ? photo.width / photo.height : 1;

        return (
          <Pressable key={`${photo.url}-${index}`} onPress={() => onOpen(photo.url)}>
            <AuthImage
              uri={photo.url}
              style={{
                width: cell,
                height: single ? Math.min(320, cell / Math.max(0.6, ratio)) : cell,
                borderRadius: radius.md,
              }}
              contentFit="cover"
            />
          </Pressable>
        );
      })}
    </View>
  );
};

const BubbleBase = ({
  row,
  color,
  onLongPress,
  onOpenPhoto,
  onRetry,
  seenLabel,
  showSender,
}: {
  row: Extract<ThreadRow, { type: "message" }>;
  color: { bg: string; fg: string };
  onLongPress: (message: ChatMsg) => void;
  onOpenPhoto: (url: string) => void;
  onRetry: (message: ChatMsg) => void;
  seenLabel: string | null;
  showSender: boolean;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { message, isFirstInRun, isLastInRun, showTime } = row;

  if (message.kind === "system") {
    return (
      <Txt tone="muted" size={12} style={styles.system}>
        {systemLine(message.systemEvent, message.eventNames, t)}
      </Txt>
    );
  }
  const mine = message.mine;
  const bg = mine ? color.bg : theme.bubbleNeutral;
  const fg = mine ? color.fg : theme.bubbleNeutralFg;
  const hasText = message.body !== "";

  return (
    <View
      style={[
        styles.row,
        {
          alignItems: mine ? "flex-end" : "flex-start",
          alignSelf: mine ? "flex-end" : "flex-start",
          marginTop: isFirstInRun ? space.sm : 2,
        },
      ]}
    >
      {showSender && !mine && isFirstInRun && message.senderName ? (
        <Txt tone="muted" size={12} style={{ marginLeft: space.sm, marginBottom: 2 }}>
          {message.senderName}
        </Txt>
      ) : null}
      {message.replyTo ? (
        <View style={[styles.quote, { borderLeftColor: theme.accent, backgroundColor: theme.surface }]}>
          <Txt size={12} tone="muted" numberOfLines={2}>
            {message.replyTo.unavailable
              ? t("chat.quoteUnavailable")
              : message.replyTo.snippet ||
                (message.replyTo.isPhoto
                  ? t("chat.photoPreview")
                  : message.replyTo.isSticker
                    ? t("chat.stickerPreview")
                    : "")}
          </Txt>
        </View>
      ) : null}
      <Pressable
        onLongPress={() => !message.deleted && message.id !== null && onLongPress(message)}
        delayLongPress={250}
        accessibilityRole="button"
        accessibilityHint={t("chat.react")}
      >
        {message.deleted ? (
          <View style={[styles.bubble, { borderColor: theme.line, borderWidth: 1 }]}>
            <Txt tone="muted" size={14} style={{ fontStyle: "italic" }}>
              {message.kind === "message" && message.body === "" ? t("chat.unsent") : message.body}
            </Txt>
          </View>
        ) : message.sticker ? (
          message.sticker.kind === "pack" ? (
            <Txt size={44}>{message.sticker.alt}</Txt>
          ) : (
            <AuthImage uri={message.sticker.url} style={styles.sticker} contentFit="contain" />
          )
        ) : (
          <View
            style={[
              styles.bubble,
              { backgroundColor: bg },
              mine ? styles.mineCorners : styles.theirCorners,
              !hasText && message.photos.length > 0 && { padding: 4 },
            ]}
          >
            {message.photos.length > 0 ? (
              <Photos photos={message.photos} onOpen={onOpenPhoto} />
            ) : null}
            {hasText ? (
              <Txt style={{ color: fg, marginTop: message.photos.length > 0 ? 6 : 0 }} selectable>
                {message.body}
              </Txt>
            ) : null}
          </View>
        )}
      </Pressable>
      {message.reactions.length > 0 ? (
        <View style={[styles.reactions, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          {message.reactions.map((reaction) => (
            <Txt key={reaction.emoji} size={12} weight={reaction.mine ? "700" : "400"}>
              {reaction.emoji}
              {reaction.count > 1 ? ` ${reaction.count}` : ""}
            </Txt>
          ))}
        </View>
      ) : null}
      {message.delivery === "failed" ? (
        <Pressable onPress={() => onRetry(message)} accessibilityRole="button">
          <Txt tone="danger" size={12}>
            {t("chat.failed")}
          </Txt>
        </Pressable>
      ) : message.delivery === "sending" ? (
        <Txt tone="muted" size={11}>
          {t("chat.sending")}
        </Txt>
      ) : isLastInRun && showTime ? (
        <Txt tone="muted" size={11} style={{ marginHorizontal: space.sm }}>
          {formatClock(new Date(message.createdAt))}
          {message.edited ? ` · ${t("common.edited")}` : ""}
          {seenLabel ? ` · ${seenLabel}` : ""}
        </Txt>
      ) : null}
    </View>
  );
};

export const MessageBubble = memo(BubbleBase);

const styles = StyleSheet.create({
  row: { maxWidth: "82%" },
  bubble: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.lg },
  mineCorners: { borderBottomRightRadius: 6 },
  theirCorners: { borderBottomLeftRadius: 6 },
  quote: {
    borderLeftWidth: 3,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 2,
    maxWidth: 260,
  },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 4, maxWidth: PHOTO_MAX },
  sticker: { width: 120, height: 120 },
  reactions: {
    flexDirection: "row",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: -6,
  },
  system: { textAlign: "center", marginVertical: space.sm, paddingHorizontal: space.xl },
});
