import type { GroupSystemEvent } from "@pt/contracts";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

import { AuthImage } from "@/components/AuthImage";
import { Button, Txt } from "@/components/ui";
import { CHAT_TEXT_ON_COLOR, chatColorHex, isChatColorKey } from "@/lib/chat-colors";
import type { ChatMsg, ThreadRow } from "@/lib/chat-model";
import { packStickerGlyph } from "@/lib/sticker-suggest";
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
      return t(
        event.resolution
          ? `groupMgmt.alert.${event.resolution.choice}`
          : "groupMgmt.alert.open",
        {
          member: name(`user:${event.userId}`),
          from: event.fromPtId ? name(`admin:${event.fromPtId}`) : t("groupMgmt.alert.noPt"),
          to: event.toPtId ? name(`admin:${event.toPtId}`) : t("groupMgmt.alert.noPt"),
        },
      );
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
  onOpenHistory,
  onOpenSeen,
  onAlert,
}: {
  row: Extract<ThreadRow, { type: "message" }>;
  color: { bg: string; fg: string };
  onLongPress: (message: ChatMsg) => void;
  onOpenPhoto: (url: string) => void;
  onRetry: (message: ChatMsg) => void;
  seenLabel: string | null;
  showSender: boolean;
  onOpenHistory?: (message: ChatMsg) => void;
  onOpenSeen?: (message: ChatMsg) => void;
  // Super admin: keep or remove a PT change (the alert line).
  onAlert?: (message: ChatMsg, choice: "keep" | "remove") => void;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { message, isFirstInRun, isLastInRun, showTime } = row;

  if (message.kind === "system") {
    const open = message.systemEvent?.type === "pt_changed" && !message.systemEvent.resolution;

    return (
      <View style={styles.system}>
        <Txt tone="muted" size={12} style={{ textAlign: "center" }}>
          {systemLine(message.systemEvent, message.eventNames, t)}
        </Txt>
        {open && onAlert ? (
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xs }}>
            <Button
              label={t("groupMgmt.alert.keepAction")}
              variant="secondary"
              style={{ minHeight: 36 }}
              onPress={() => onAlert(message, "keep")}
            />
            <Button
              label={t("groupMgmt.alert.removeAction")}
              variant="danger"
              style={{ minHeight: 36 }}
              onPress={() => onAlert(message, "remove")}
            />
          </View>
        ) : null}
      </View>
    );
  }
  const mine = message.mine;
  const picked = isChatColorKey(message.colorKey) ? message.colorKey : null;
  const bg = mine
    ? picked
      ? chatColorHex(picked)
      : color.bg
    : picked
      ? chatColorHex(picked)
      : theme.bubbleNeutral;
  const fg = mine ? (picked ? CHAT_TEXT_ON_COLOR : color.fg) : picked ? CHAT_TEXT_ON_COLOR : theme.bubbleNeutralFg;
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
          {message.senderTag ? ` · ${t(`chatx.role.${message.senderTag === "manager" ? "super_admin" : "pt"}`)}` : ""}
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
        onLongPress={() => message.id !== null && onLongPress(message)}
        delayLongPress={250}
        accessibilityRole="button"
        accessibilityHint={t("chat.react")}
      >
        {message.deleted ? (
          <View style={[styles.bubble, { borderColor: theme.line, borderWidth: 1 }]}>
            <Txt tone="muted" size={14} style={{ fontStyle: "italic" }}>
              {message.hidden
                ? t("chat.hidden")
                : message.kind === "message" && message.body === ""
                  ? t("chat.unsent")
                  : message.body}
            </Txt>
          </View>
        ) : message.sticker ? (
          message.sticker.kind === "pack" ? (
            <Txt size={52} accessibilityLabel={message.sticker.alt}>
              {packStickerGlyph(message.sticker.url, message.sticker.alt)}
            </Txt>
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
        <View style={{ flexDirection: "row", marginHorizontal: space.sm }}>
          <Txt tone="muted" size={11}>
            {formatClock(new Date(message.createdAt))}
          </Txt>
          {message.edited ? (
            <Pressable accessibilityRole="button" onPress={() => onOpenHistory?.(message)} hitSlop={6}>
              <Txt tone="muted" size={11}>
                {` · ${t("common.edited")}`}
              </Txt>
            </Pressable>
          ) : null}
          {seenLabel ? (
            <Pressable accessibilityRole="button" onPress={() => onOpenSeen?.(message)} hitSlop={6}>
              <Txt tone="muted" size={11}>
                {` · ${seenLabel}`}
              </Txt>
            </Pressable>
          ) : null}
        </View>
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
  system: { alignItems: "center", marginVertical: space.sm, paddingHorizontal: space.xl },
});
