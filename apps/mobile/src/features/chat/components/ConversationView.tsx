import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { AuthImage } from "@/components/AuthImage";
import { Avatar } from "@/components/Avatar";
import { ReactionPicker } from "@/components/ReactionPicker";
import { Sheet, SheetAction } from "@/components/Sheet";
import { EmptyState, ErrorState, IconButton, Screen, Skeleton, Spinner, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import {
  applyMessageReaction,
  buildRows,
  type ChatMsg,
  lastSeenOwnId,
  myReactionOf,
  optimisticMessage,
  type ThreadRow,
} from "@/lib/chat-model";
import { nextReaction } from "@/lib/reactions";
import { formatDayLabel } from "@/lib/time";
import { confirmAction, useErrorText, uuid } from "@/lib/ui-helpers";
import { space, useTheme } from "@/theme";

import type { ChatApi, SendPayload } from "../api";
import type { useThread } from "../use-thread";
import { Composer, type ComposeSubmit } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import type { PickedSticker } from "./StickerSheet";

type Thread = ReturnType<typeof useThread<unknown>>;

export type ConversationViewProps = {
  title: string;
  subtitle?: string | null;
  avatarName: string;
  avatarUri?: string | null;
  thread: Thread;
  chat: ChatApi | null;
  color: { bg: string; fg: string };
  showSender?: boolean;
  seenMode?: "peer" | "count" | "none";
  peerTyping?: boolean;
  onTyping?: () => void;
  // Replaces the composer (chat locked, read-only, not a member...).
  banner?: string | null;
  allowStickers?: boolean;
  headerRight?: React.ReactNode;
};

export const ConversationView = ({
  title,
  subtitle,
  avatarName,
  avatarUri,
  thread,
  chat,
  color,
  showSender = false,
  seenMode = "none",
  peerTyping = false,
  onTyping,
  banner,
  allowStickers = true,
  headerRight,
}: ConversationViewProps) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const [replyTo, setReplyTo] = useState<ChatMsg | null>(null);
  const [editing, setEditing] = useState<ChatMsg | null>(null);
  const [actionsFor, setActionsFor] = useState<ChatMsg | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  // What was sent for each unconfirmed bubble, so a failed one can be retried.
  const payloads = useRef(new Map<string, SendPayload>());

  const rows = useMemo(() => buildRows(thread.messages), [thread.messages]);
  // Inverted list: newest first.
  const data = useMemo(() => [...rows].reverse(), [rows]);
  const seenId =
    seenMode === "peer" ? lastSeenOwnId(thread.messages, thread.peerReadUpTo) : null;
  const lastOwnId = useMemo(
    () => [...thread.messages].reverse().find((m) => m.mine && m.id !== null)?.id ?? null,
    [thread.messages],
  );

  const transmit = async (clientId: string) => {
    const payload = payloads.current.get(clientId);

    if (!chat || !payload) {
      return;
    }
    try {
      const stored = await chat.send(payload, clientId);

      payloads.current.delete(clientId);
      thread.confirm(stored);
    } catch (error) {
      thread.markFailed(clientId);
      Alert.alert(errorText(error));
    }
  };

  const sendMessage = (value: ComposeSubmit) => {
    const clientId = uuid();
    const payload: SendPayload = {
      ...(value.body ? { body: value.body } : {}),
      ...(value.photoIds.length > 0 ? { photoIds: value.photoIds } : {}),
      ...(replyTo?.id ? { replyToMessageId: replyTo.id } : {}),
    };

    payloads.current.set(clientId, payload);
    thread.putPending(
      optimisticMessage({
        clientId,
        body: value.body,
        photos: value.previews,
        replyTo: replyTo
          ? {
              id: replyTo.id ?? 0,
              snippet: replyTo.body,
              senderName: replyTo.senderName,
              isPhoto: replyTo.photos.length > 0,
              isSticker: replyTo.sticker !== null,
              unavailable: false,
            }
          : null,
      }),
    );
    setReplyTo(null);
    void transmit(clientId);
  };

  const sendSticker = (sticker: PickedSticker, preview: { url: string; alt: string }) => {
    const clientId = uuid();

    payloads.current.set(clientId, { sticker });
    thread.putPending({
      ...optimisticMessage({ clientId, body: "" }),
      sticker: { url: preview.url, alt: preview.alt, kind: "giphy" in sticker ? "giphy" : "custom" },
    });
    void transmit(clientId);
  };

  const retry = (message: ChatMsg) => {
    thread.putPending({ ...message, delivery: "sending" });
    void transmit(message.clientId);
  };

  const react = async (message: ChatMsg, emoji: string) => {
    if (!chat || message.id === null) {
      return;
    }
    const messageId = message.id;
    const next = nextReaction(myReactionOf(message), emoji);

    thread.patchMessage(messageId, (m) => ({
      ...m,
      reactions: applyMessageReaction(m.reactions, next),
    }));
    try {
      await chat.react(messageId, next);
      void thread.sync();
    } catch (error) {
      Alert.alert(errorText(error));
      void thread.sync();
    }
  };

  const submitEdit = async (message: ChatMsg, body: string) => {
    if (!chat || message.id === null) {
      return;
    }
    const messageId = message.id;

    setEditing(null);
    thread.patchMessage(messageId, (m) => ({ ...m, body, edited: true }));
    try {
      await chat.edit(messageId, body);
      void thread.sync();
    } catch (error) {
      Alert.alert(errorText(error));
      void thread.refresh();
    }
  };

  const unsend = (message: ChatMsg) => {
    if (!chat || message.id === null) {
      return;
    }
    const messageId = message.id;

    confirmAction({
      title: t("chat.unsendConfirm"),
      confirmLabel: t("chat.unsend"),
      cancelLabel: t("common.cancel"),
      destructive: true,
      onConfirm: () => {
        thread.patchMessage(messageId, (m) => ({
          ...m,
          deleted: true,
          body: "",
          photos: [],
          sticker: null,
          reactions: [],
        }));
        chat.unsend(messageId).then(
          () => void thread.sync(),
          (error) => {
            Alert.alert(errorText(error));
            void thread.refresh();
          },
        );
      },
    });
  };

  const renderItem = ({ item }: { item: ThreadRow }) => {
    if (item.type === "day") {
      return (
        <Txt tone="muted" size={12} style={styles.day}>
          {formatDayLabel(item.at, new Date(), currentLocale(), {
            today: t("time.today"),
            yesterday: t("time.yesterday"),
          })}
        </Txt>
      );
    }
    const id = item.message.id;
    const seenLabel =
      id !== null && seenMode === "peer" && id === seenId && id === lastOwnId
        ? t("chat.seen")
        : seenMode === "count" && id !== null && id === lastOwnId && item.message.seenCount > 0
          ? t("chat.seenBy", { count: item.message.seenCount })
          : null;

    return (
      <View style={{ paddingHorizontal: space.md }}>
        <MessageBubble
          row={item}
          color={color}
          showSender={showSender}
          seenLabel={seenLabel}
          onLongPress={setActionsFor}
          onOpenPhoto={setViewerUri}
          onRetry={retry}
        />
      </View>
    );
  };

  const actions = actionsFor;
  const canEdit =
    actions !== null && actions.mine && chat !== null && actions.body !== "" && actions.sticker === null;

  return (
    <Screen>
      <View style={[styles.header, { borderBottomColor: theme.line }]}>
        <IconButton name="chevron-back" label={t("common.back")} onPress={() => router.back()} />
        <Avatar name={avatarName} uri={avatarUri} size={36} />
        <View style={{ flex: 1 }}>
          <Txt weight="600" numberOfLines={1}>
            {title}
          </Txt>
          {peerTyping ? (
            <Txt tone="accent" size={12}>
              {t("chat.typing")}
            </Txt>
          ) : subtitle ? (
            <Txt tone="muted" size={12} numberOfLines={1}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {headerRight}
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {thread.status === "loading" ? (
          <View style={{ flex: 1, padding: space.lg, gap: space.md, justifyContent: "flex-end" }}>
            <Skeleton width="60%" height={36} />
            <Skeleton width="45%" height={36} style={{ alignSelf: "flex-end" }} />
            <Skeleton width="70%" height={36} />
          </View>
        ) : thread.status === "error" && thread.messages.length === 0 ? (
          <ErrorState message={errorText(thread.error)} onRetry={() => void thread.refresh()} />
        ) : (
          <FlatList
            inverted
            data={data}
            keyExtractor={(row) => row.key}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (thread.hasMore && !thread.loadingOlder) {
                void thread.loadOlder();
              }
            }}
            ListFooterComponent={thread.loadingOlder ? <Spinner /> : undefined}
            ListEmptyComponent={
              <View style={{ transform: [{ scaleY: -1 }], flex: 1 }}>
                <EmptyState title={t("chat.empty_thread")} />
              </View>
            }
            contentContainerStyle={{ paddingVertical: space.sm, flexGrow: 1 }}
          />
        )}
        {chat && !banner ? (
          <Composer
            uploadPhoto={chat.uploadPhoto}
            onSubmit={sendMessage}
            onSticker={sendSticker}
            onTyping={onTyping}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            editing={editing}
            onCancelEdit={() => setEditing(null)}
            onSubmitEdit={(message, body) => void submitEdit(message, body)}
            allowStickers={allowStickers}
          />
        ) : banner ? (
          <View style={[styles.banner, { backgroundColor: theme.surface, borderTopColor: theme.line }]}>
            <Txt tone="muted" size={13} style={{ textAlign: "center" }}>
              {banner}
            </Txt>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <Sheet visible={actions !== null} onClose={() => setActionsFor(null)}>
        {actions && chat ? (
          <View style={{ gap: space.sm }}>
            <ReactionPicker
              mine={myReactionOf(actions)}
              onPick={(emoji) => {
                setActionsFor(null);
                void react(actions, emoji);
              }}
            />
            <SheetAction
              label={t("chat.reply")}
              onPress={() => {
                setReplyTo(actions);
                setActionsFor(null);
              }}
            />
            {canEdit ? (
              <SheetAction
                label={t("chat.editMessage")}
                onPress={() => {
                  setEditing(actions);
                  setActionsFor(null);
                }}
              />
            ) : null}
            {actions.mine ? (
              <SheetAction
                danger
                label={t("chat.unsend")}
                onPress={() => {
                  setActionsFor(null);
                  unsend(actions);
                }}
              />
            ) : null}
          </View>
        ) : null}
      </Sheet>

      <Modal visible={viewerUri !== null} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewerUri(null)} accessibilityRole="button">
          {viewerUri ? (
            <AuthImage uri={viewerUri} style={{ width: "100%", height: "80%" }} contentFit="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  day: { textAlign: "center", marginVertical: space.md },
  banner: { padding: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
});
