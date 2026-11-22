import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";

import { Sheet } from "@/components/Sheet";
import { ErrorState, Spinner, Txt } from "@/components/ui";
import { radius, space, useTheme } from "@/theme";

import { useReactors } from "../hooks";

export const ReactorsSheet = ({
  postId,
  visible,
  onClose,
}: {
  postId: number;
  visible: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const query = useReactors(postId, visible);
  const [filter, setFilter] = useState<string | null>(null);

  return (
    <Sheet visible={visible} onClose={onClose} title={t("feed.reactors")}>
      {query.isPending ? (
        <Spinner />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <Txt tone="muted">{t("feed.reactorsEmpty")}</Txt>
      ) : (
        <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: space.sm }}>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            {[null, ...Array.from(new Set(query.data.items.map((item) => item.emoji)))].map((emoji) => {
              const count = emoji === null ? query.data.items.length : query.data.items.filter((i) => i.emoji === emoji).length;
              const active = (filter === emoji) || (emoji === null && filter === null);

              return (
                <Pressable
                  key={emoji ?? "all"}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setFilter(emoji)}
                  style={{
                    minHeight: 36,
                    paddingHorizontal: space.md,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: active ? theme.accent : theme.line,
                    justifyContent: "center",
                  }}
                >
                  <Txt size={14} weight={active ? "700" : "400"}>
                    {emoji ?? t("feedExtra.reactorsAll")} {count}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <ScrollView style={{ maxHeight: 340 }}>
          {query.data.items.filter((item) => filter === null || item.emoji === filter).map((item, index) => (
            <View
              key={`${item.name}-${index}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}
            >
              <Txt size={22}>{item.emoji}</Txt>
              <Txt weight={item.isMe ? "700" : "400"}>
                {item.isMe ? t("common.you") : item.name}
              </Txt>
            </View>
          ))}
        </ScrollView>
        </>
      )}
    </Sheet>
  );
};
