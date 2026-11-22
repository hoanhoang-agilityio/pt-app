import { Ionicons } from "@expo/vector-icons";
import { CHAT_BODY_MAX_LENGTH, CHAT_MESSAGE_MAX_PHOTOS, CHAT_PHOTO_UPLOAD_CONCURRENCY } from "@pt/contracts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthImage } from "@/components/AuthImage";
import { Txt } from "@/components/ui";
import type { ChatMsg } from "@/lib/chat-model";
import { PhotoPermissionError, pickPhotos,type PreparedPhoto } from "@/lib/photos";
import { useErrorText } from "@/lib/ui-helpers";
import { usePhotoUploads } from "@/lib/use-photo-uploads";
import { radius, space, useTheme } from "@/theme";

import { type PickedSticker, StickerSheet } from "./StickerSheet";

export type ComposeSubmit = {
  body: string;
  photoIds: number[];
  previews: { url: string; width: number; height: number }[];
};

// Keyboard-aware input row: text, photos (uploaded as soon as they are picked),
// stickers, a reply banner and an edit mode. The screen wraps it in a
// KeyboardAvoidingView.
export const Composer = ({
  uploadPhoto,
  onSubmit,
  onSticker,
  onTyping,
  replyTo,
  onCancelReply,
  editing,
  onCancelEdit,
  onSubmitEdit,
  allowStickers = true,
}: {
  uploadPhoto: (photo: PreparedPhoto) => Promise<number>;
  onSubmit: (value: ComposeSubmit) => void;
  onSticker: (sticker: PickedSticker, preview: { url: string; alt: string }) => void;
  onTyping?: () => void;
  replyTo: ChatMsg | null;
  onCancelReply: () => void;
  editing: ChatMsg | null;
  onCancelEdit: () => void;
  onSubmitEdit: (message: ChatMsg, body: string) => void;
  allowStickers?: boolean;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const errorText = useErrorText();
  const [text, setText] = useState("");
  const [stickersOpen, setStickersOpen] = useState(false);
  const photos = usePhotoUploads({
    max: CHAT_MESSAGE_MAX_PHOTOS,
    concurrency: CHAT_PHOTO_UPLOAD_CONCURRENCY,
    upload: uploadPhoto,
  });

  useEffect(() => {
    if (editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(editing.body);
    }
  }, [editing]);

  const trimmed = text.trim();
  const canSend =
    editing !== null
      ? trimmed !== "" && trimmed !== editing.body
      : (trimmed !== "" || photos.ids.length > 0) && !photos.isUploading && !photos.hasFailed;

  const submit = () => {
    if (!canSend) {
      return;
    }
    if (editing) {
      onSubmitEdit(editing, trimmed);
      setText("");
      return;
    }
    onSubmit({
      body: trimmed,
      photoIds: photos.ids,
      previews: photos.items.map((item) => ({
        url: item.previewUri,
        width: item.picked.width,
        height: item.picked.height,
      })),
    });
    setText("");
    photos.reset();
  };

  const addPhotos = async () => {
    try {
      const picked = await pickPhotos(CHAT_MESSAGE_MAX_PHOTOS - photos.items.length);

      photos.add(picked);
    } catch (caught) {
      Alert.alert(
        caught instanceof PhotoPermissionError
          ? t("composer.permissionDenied")
          : errorText(caught),
      );
    }
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
          paddingBottom: Math.max(insets.bottom, space.sm),
        },
      ]}
    >
      {replyTo ? (
        <View style={styles.banner}>
          <Txt size={12} tone="muted" numberOfLines={1} style={{ flex: 1 }}>
            {t("chat.replyingTo", { name: replyTo.senderName ?? t("common.you") })}:{" "}
            {replyTo.body || (replyTo.photos.length > 0 ? t("chat.photoPreview") : t("chat.stickerPreview"))}
          </Txt>
          <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={onCancelReply}>
            <Ionicons name="close" size={18} color={theme.muted} />
          </Pressable>
        </View>
      ) : null}
      {editing ? (
        <View style={styles.banner}>
          <Txt size={12} tone="accent" style={{ flex: 1 }}>
            {t("chat.editing")}
          </Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
            onPress={() => {
              setText("");
              onCancelEdit();
            }}
          >
            <Ionicons name="close" size={18} color={theme.muted} />
          </Pressable>
        </View>
      ) : null}
      {photos.items.length > 0 && !editing ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            {photos.items.map((item) => (
              <View key={item.key} style={[styles.thumb, { backgroundColor: theme.line }]}>
                <AuthImage uri={item.previewUri} style={styles.thumb} contentFit="cover" />
                {item.status === "uploading" ? (
                  <View style={styles.thumbOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : null}
                {item.status === "error" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("composer.retryPhoto")}
                    onPress={() => photos.retry(item.key)}
                    style={styles.thumbOverlay}
                  >
                    <Ionicons name="refresh" size={20} color="#fff" />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("composer.removePhoto")}
                  hitSlop={6}
                  onPress={() => photos.remove(item.key)}
                  style={styles.thumbRemove}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
      <View style={styles.row}>
        {!editing ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("chat.addPhoto")}
              onPress={() => void addPhotos()}
              hitSlop={6}
              style={styles.iconButton}
            >
              <Ionicons name="image-outline" size={24} color={theme.accent} />
            </Pressable>
            {allowStickers ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("chat.stickers")}
                onPress={() => setStickersOpen(true)}
                hitSlop={6}
                style={styles.iconButton}
              >
                <Ionicons name="happy-outline" size={24} color={theme.accent} />
              </Pressable>
            ) : null}
          </>
        ) : null}
        <TextInput
          value={text}
          onChangeText={(value) => {
            setText(value);
            onTyping?.();
          }}
          placeholder={t("chat.placeholder")}
          placeholderTextColor={theme.muted}
          multiline
          maxLength={CHAT_BODY_MAX_LENGTH}
          style={[styles.input, { color: theme.fg, borderColor: theme.line, backgroundColor: theme.bg }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("chat.send")}
          accessibilityState={{ disabled: !canSend }}
          onPress={submit}
          disabled={!canSend}
          style={[styles.send, { backgroundColor: theme.accent, opacity: canSend ? 1 : 0.4 }]}
        >
          <Ionicons name={editing ? "checkmark" : "arrow-up"} size={20} color={theme.accentFg} />
        </Pressable>
      </View>
      <StickerSheet
        visible={stickersOpen}
        onClose={() => setStickersOpen(false)}
        onPick={onSticker}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.sm, paddingTop: space.sm },
  banner: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.sm, paddingBottom: space.sm },
  row: { flexDirection: "row", alignItems: "flex-end", gap: space.xs },
  iconButton: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: space.lg,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
  },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, overflow: "hidden" },
  thumbOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbRemove: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});
