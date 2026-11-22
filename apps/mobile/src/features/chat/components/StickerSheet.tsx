import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";

import { AuthImage } from "@/components/AuthImage";
import { Sheet } from "@/components/Sheet";
import { Spinner, Txt } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { radius, space, useTheme } from "@/theme";

import { fetchCustomStickers, fetchGiphy } from "../api";

export type PickedSticker =
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
      <View style={{ height: 320 }}>
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
});
