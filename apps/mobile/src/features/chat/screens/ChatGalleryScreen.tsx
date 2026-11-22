import { CHAT_GALLERY_TABS, type ChatGalleryTab } from "@pt/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Linking, Modal, Pressable, StyleSheet, View } from "react-native";

import { AuthImage } from "@/components/AuthImage";
import { EmptyState, ErrorState, Screen, Spinner, Txt } from "@/components/ui";
import { qk } from "@/lib/query-keys";
import { packStickerGlyph } from "@/lib/sticker-suggest";
import { useErrorText } from "@/lib/ui-helpers";
import { space, useTheme } from "@/theme";

import { type CoachScope, fetchGallery } from "../api-manage";

type GalleryItem = {
  messageId: number;
  url?: string;
  alt?: string;
  kind?: string;
  href?: string;
  text?: string;
  domain?: string;
  key?: string;
};

// Photos, stickers and links of a coach conversation (tabs, paged).
export const ChatGalleryScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const params = useLocalSearchParams<{ cid: string }>();
  const scope: CoachScope = params.cid === "me" ? "me" : Number(params.cid);
  const [tab, setTab] = useState<ChatGalleryTab>("photos");
  const [viewer, setViewer] = useState<string | null>(null);
  const query = useInfiniteQuery({
    queryKey: qk.chatGallery(String(scope), tab),
    queryFn: ({ pageParam }) => fetchGallery(scope, tab, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = (query.data?.pages ?? []).flatMap((page) => page.items as GalleryItem[]);

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t("chatGallery.title") }} />
      <View style={[styles.tabs, { backgroundColor: theme.line }]}>
        {CHAT_GALLERY_TABS.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && { backgroundColor: theme.surface }]}
          >
            <Txt size={14} weight="600" tone={tab === value ? "default" : "muted"}>
              {t(`chatGallery.tabs.${value}`)}
            </Txt>
          </Pressable>
        ))}
      </View>
      {query.isPending ? (
        <Spinner />
      ) : query.isError ? (
        <ErrorState message={errorText(query.error)} onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          key={tab}
          data={items}
          numColumns={tab === "links" ? 1 : 3}
          keyExtractor={(item, index) => `${item.messageId}-${item.key ?? item.url ?? index}`}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              void query.fetchNextPage();
            }
          }}
          contentContainerStyle={{ flexGrow: 1 }}
          ListEmptyComponent={<EmptyState icon="images-outline" title={t(`chatGallery.empty.${tab}`)} />}
          renderItem={({ item }) =>
            tab === "links" ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => item.href && void Linking.openURL(item.href)}
                style={[styles.link, { borderBottomColor: theme.line }]}
              >
                <Txt weight="600" numberOfLines={1}>
                  {item.domain}
                </Txt>
                <Txt tone="muted" size={13} numberOfLines={2}>
                  {item.text}
                </Txt>
              </Pressable>
            ) : tab === "stickers" && item.kind === "pack" ? (
              <View style={styles.cell}>
                <Txt size={40} accessibilityLabel={item.alt}>
                  {packStickerGlyph(item.url ?? "", item.alt ?? "")}
                </Txt>
              </View>
            ) : (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel={item.alt ?? t("common.photo")}
                onPress={() => tab === "photos" && item.url && setViewer(item.url)}
                style={styles.cell}
              >
                <AuthImage
                  uri={item.url}
                  style={{ width: "100%", height: "100%" }}
                  contentFit={tab === "photos" ? "cover" : "contain"}
                />
              </Pressable>
            )
          }
        />
      )}
      <Modal visible={viewer !== null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewer(null)} accessibilityRole="button">
          {viewer ? <AuthImage uri={viewer} style={{ width: "100%", height: "80%" }} contentFit="contain" /> : null}
        </Pressable>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", borderRadius: 10, padding: 3, margin: space.lg },
  tab: { flex: 1, minHeight: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cell: { flex: 1 / 3, aspectRatio: 1, padding: 2, alignItems: "center", justifyContent: "center" },
  link: { padding: space.lg, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
});
