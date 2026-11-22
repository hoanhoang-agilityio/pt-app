import { Ionicons } from "@expo/vector-icons";
import {
  SOCIAL_CAPTION_MAX_LENGTH,
  SOCIAL_POST_PHOTO_UPLOAD_CONCURRENCY,
  SOCIAL_POST_PRIVACIES,
  type SocialPostPrivacy,
} from "@pt/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { AuthImage } from "@/components/AuthImage";
import { Button, Screen, Txt } from "@/components/ui";
import { MAX_POST_PHOTOS } from "@/lib/image-plan";
import { PhotoPermissionError, pickPhotos } from "@/lib/photos";
import { qk } from "@/lib/query-keys";
import { newKey, useErrorText } from "@/lib/ui-helpers";
import { usePhotoUploads } from "@/lib/use-photo-uploads";
import { radius, space, useTheme } from "@/theme";

import { createPost, editPost, uploadPostPhoto } from "./api";
import { updatePostEverywhere } from "./cache";
import { usePost, useSocialMe } from "./hooks";

// New post (caption, privacy, up to 10 photos) or, with ?postId=, an edit of
// the caption and privacy (photos cannot change after posting).
export const ComposerScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  const editId = postId ? Number(postId) : null;
  const existing = usePost(editId ?? 0, editId !== null);
  const social = useSocialMe();
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<SocialPostPrivacy | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per submit attempt; kept while the attempt is retried.
  const submitKey = useRef<string | null>(null);
  const photos = usePhotoUploads({
    max: MAX_POST_PHOTOS,
    concurrency: SOCIAL_POST_PHOTO_UPLOAD_CONCURRENCY,
    upload: uploadPostPhoto,
  });
  const loaded = useRef(false);

  useEffect(() => {
    if (editId !== null && existing.data && !loaded.current) {
      loaded.current = true;
      setCaption(existing.data.caption);
      setPrivacy(existing.data.privacy);
    }
  }, [editId, existing.data]);

  const chosenPrivacy: SocialPostPrivacy =
    privacy ?? social.data?.postPrivacyDefault ?? "friends";

  const addPhotos = async () => {
    try {
      const picked = await pickPhotos(MAX_POST_PHOTOS - photos.items.length);
      const dropped = photos.add(picked);

      if (dropped > 0) {
        Alert.alert(t("composer.photoSlotsFull", { max: MAX_POST_PHOTOS }));
      }
    } catch (caught) {
      Alert.alert(
        caught instanceof PhotoPermissionError
          ? t("composer.permissionDenied")
          : errorText(caught),
      );
    }
  };

  const submit = async () => {
    if (caption.trim() === "" && photos.items.length === 0) {
      setError(t("composer.empty"));
      return;
    }
    if (photos.isUploading || photos.hasFailed) {
      setError(t("composer.photosPending"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editId !== null) {
        await editPost(editId, { caption: caption.trim(), privacy: chosenPrivacy });
        updatePostEverywhere(queryClient, editId, (post) => ({
          ...post,
          caption: caption.trim(),
          privacy: chosenPrivacy,
          edited: true,
        }));
      } else {
        submitKey.current ??= newKey();
        await createPost(
          { caption: caption.trim(), privacy: chosenPrivacy, photoIds: photos.ids },
          submitKey.current,
        );
      }
      await queryClient.invalidateQueries({ queryKey: qk.feed });
      await queryClient.invalidateQueries({ queryKey: ["social", "profile-posts"] });
      router.back();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const inputColors = { color: theme.fg, backgroundColor: theme.surface, borderColor: theme.line };

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen
        options={{ title: t(editId !== null ? "composer.editTitle" : "composer.title") }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder={t("composer.placeholder")}
            placeholderTextColor={theme.muted}
            multiline
            maxLength={SOCIAL_CAPTION_MAX_LENGTH}
            style={[styles.caption, inputColors]}
            textAlignVertical="top"
            accessibilityLabel={t("composer.placeholder")}
          />
          <View style={styles.chips}>
            {SOCIAL_POST_PRIVACIES.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: chosenPrivacy === value }}
                onPress={() => setPrivacy(value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: chosenPrivacy === value ? theme.accent : theme.surface,
                    borderColor: theme.line,
                  },
                ]}
              >
                <Txt
                  size={13}
                  weight="600"
                  style={{ color: chosenPrivacy === value ? theme.accentFg : theme.fg }}
                >
                  {t(`feed.privacy.${value}`)}
                </Txt>
              </Pressable>
            ))}
          </View>

          {editId === null ? (
            <View style={{ gap: space.sm }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  {photos.items.map((item) => (
                    <View key={item.key} style={[styles.thumb, { backgroundColor: theme.line }]}>
                      <AuthImage uri={item.previewUri} style={styles.thumbImage} contentFit="cover" />
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
                          <Ionicons name="refresh" size={22} color="#fff" />
                          <Txt size={11} style={{ color: "#fff" }}>
                            {t("composer.photoFailed")}
                          </Txt>
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("composer.removePhoto")}
                        onPress={() => photos.remove(item.key)}
                        hitSlop={6}
                        style={styles.thumbRemove}
                      >
                        <Ionicons name="close" size={16} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                  {photos.items.length < MAX_POST_PHOTOS ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("composer.addPhoto")}
                      onPress={() => void addPhotos()}
                      style={[styles.thumb, styles.add, { borderColor: theme.line }]}
                    >
                      <Ionicons name="images-outline" size={26} color={theme.accent} />
                    </Pressable>
                  ) : null}
                </View>
              </ScrollView>
              <Txt tone="muted" size={12}>
                {t("composer.counter", { count: photos.items.length, max: MAX_POST_PHOTOS })}
              </Txt>
            </View>
          ) : null}

          {error ? (
            <Txt tone="danger" size={14} accessibilityRole="alert">
              {error}
            </Txt>
          ) : null}
        </ScrollView>
        <View style={{ padding: space.lg }}>
          <Button
            label={t(busy ? "composer.publishing" : "composer.publish")}
            loading={busy}
            disabled={editId !== null && !existing.data}
            onPress={() => void submit()}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  caption: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 16,
  },
  chips: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    minHeight: 36,
    justifyContent: "center",
  },
  thumb: { width: 96, height: 96, borderRadius: radius.md, overflow: "hidden" },
  thumbImage: { width: 96, height: 96 },
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
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  add: { borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
});
