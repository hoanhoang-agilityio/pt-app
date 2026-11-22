import { STICKER_BUNDLED_GROUPS, STICKER_PACK_ID, stickerBundledUrl } from "@pt/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";

import { AuthImage } from "@/components/AuthImage";
import { Sheet } from "@/components/Sheet";
import { Spinner, Txt } from "@/components/ui";
import { PhotoPermissionError, pickPhotos, STICKER_CONTENT_TYPE, toStickerBlob } from "@/lib/photos";
import { qk } from "@/lib/query-keys";
import { packStickerGlyph } from "@/lib/sticker-suggest";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { radius, space, useTheme } from "@/theme";

import { fetchCustomStickers, fetchGiphy } from "../api";
import { deleteCustomSticker, uploadCustomSticker } from "../api-manage";

export type PickedSticker =
  | { pack: string; id: string }
  | { customId: number }
  | { giphyId: string; url: string };

type Cell = { key: string; uri: string; sticker: PickedSticker; alt: string };

// My own stickers and GIPHY search (through the API's cached proxy).
export const StickerSheet = ({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (sticker: PickedSticker, preview: { url: string; alt: string }) => void;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const giphy = useQuery({
    queryKey: qk.giphy(query),
    queryFn: () => fetchGiphy(query),
    enabled: visible,
    staleTime: 5 * 60_000,
  });
  const mine = useQuery({
    queryKey: qk.customStickers,
    queryFn: fetchCustomStickers,
    enabled: visible,
  });

  const addCustom = useMutation({
    mutationFn: async () => {
      try {
        const [picked] = await pickPhotos(1);

        if (picked) {
          await uploadCustomSticker(await toStickerBlob(picked), STICKER_CONTENT_TYPE);
        }
      } catch (error) {
        if (error instanceof PhotoPermissionError) {
          throw new Error(t("composer.permissionDenied"));
        }
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.customStickers }),
    onError: (error) => Alert.alert(errorText(error)),
  });
  const removeCustom = useMutation({
    mutationFn: (id: number) => deleteCustomSticker(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.customStickers }),
    onError: (error) => Alert.alert(errorText(error)),
  });
  const bundled: { id: string; alt: string }[] = STICKER_BUNDLED_GROUPS.flatMap((group) => [...group.stickers]);

  const cells: Cell[] = [
    ...(mine.data?.stickers ?? []).map((s) => ({
      key: `c${s.id}`,
      uri: s.url,
      sticker: { customId: s.id },
      alt: t("chat.stickerMine"),
    })),
    ...(giphy.data?.stickers ?? []).map((s) => ({
      key: `g${s.giphyId}`,
      uri: s.previewUrl || s.url,
      sticker: { giphyId: s.giphyId, url: s.url },
      alt: s.alt,
    })),
  ];

  return (
    <Sheet visible={visible} onClose={onClose} title={t("chat.stickers")}>
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => setQuery(text.trim())}
        returnKeyType="search"
        placeholder={t("chat.stickerSearch")}
        placeholderTextColor={theme.muted}
        style={[styles.input, { color: theme.fg, borderColor: theme.line }]}
      />
      <FlatList
        horizontal
        data={bundled}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: space.sm }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.alt}
            style={styles.packCell}
            onPress={() => {
              const url = stickerBundledUrl(STICKER_PACK_ID, item.id);

              onPick({ pack: STICKER_PACK_ID, id: item.id }, { url, alt: item.alt });
              onClose();
            }}
          >
            <Txt size={30}>{packStickerGlyph(stickerBundledUrl(STICKER_PACK_ID, item.id), item.alt)}</Txt>
          </Pressable>
        )}
      />
      <View style={{ flexDirection: "row", gap: space.sm, marginBottom: space.sm }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => addCustom.mutate()}
          disabled={addCustom.isPending}
          style={[styles.addButton, { borderColor: theme.line }]}
        >
          <Txt tone="accent" size={13} weight="600">
            {addCustom.isPending ? t("common.loading") : t("chatx.addSticker")}
          </Txt>
        </Pressable>
        <Txt tone="muted" size={12} style={{ alignSelf: "center", flex: 1 }}>
          {t("chatx.stickerHoldHint")}
        </Txt>
      </View>
      <View style={{ height: 280 }}>
        {giphy.isPending && mine.isPending ? (
          <Spinner />
        ) : (
          <FlatList
            data={cells}
            numColumns={3}
            keyExtractor={(cell) => cell.key}
            ListEmptyComponent={
              <Txt tone="muted" style={{ textAlign: "center", padding: space.lg }}>
                {giphy.data && !giphy.data.enabled ? t("chat.stickerOff") : t("chat.stickerEmpty")}
              </Txt>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.alt}
                style={styles.cell}
                onLongPress={() => {
                  if ("customId" in item.sticker) {
                    const id = item.sticker.customId;

                    confirmAction({
                      title: t("chatx.deleteSticker"),
                      confirmLabel: t("common.delete"),
                      cancelLabel: t("common.cancel"),
                      destructive: true,
                      onConfirm: () => removeCustom.mutate(id),
                    });
                  }
                }}
                onPress={() => {
                  onPick(item.sticker, { url: item.uri, alt: item.alt });
                  onClose();
                }}
              >
                <AuthImage uri={item.uri} style={styles.image} contentFit="contain" />
              </Pressable>
            )}
          />
        )}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
    fontSize: 15,
  },
  cell: { flex: 1 / 3, aspectRatio: 1, padding: 4 },
  image: { width: "100%", height: "100%" },
  packCell: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  addButton: { minHeight: 36, paddingHorizontal: space.md, borderWidth: 1, borderRadius: radius.pill, justifyContent: "center" },
});
