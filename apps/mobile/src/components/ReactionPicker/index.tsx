import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Sheet } from "@/components/Sheet";
import { EMOJI_GRID, isSingleEmoji, REACTION_BAR } from "@/lib/emoji";
import { radius, space, useTheme } from "@/theme";

// The default bar (❤️ 😂 😮 😢 😡 👍) plus a "+" that opens a simple emoji grid.
// `onPick` gets one validated emoji; the caller sends it to the API.
export const ReactionPicker = ({
  mine,
  onPick,
}: {
  mine?: string | null;
  onPick: (emoji: string) => void;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [gridOpen, setGridOpen] = useState(false);

  const pick = (emoji: string) => {
    if (isSingleEmoji(emoji)) {
      onPick(emoji);
    }
    setGridOpen(false);
  };

  return (
    <View style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      {REACTION_BAR.map((emoji) => (
        <Pressable
          key={emoji}
          accessibilityRole="button"
          accessibilityLabel={emoji}
          onPress={() => pick(emoji)}
          style={[styles.item, mine === emoji && { backgroundColor: theme.line }]}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("feed.emojiPicker")}
        onPress={() => setGridOpen(true)}
        style={styles.item}
      >
        <Text style={[styles.emoji, { color: theme.muted }]}>＋</Text>
      </Pressable>
      <Sheet visible={gridOpen} onClose={() => setGridOpen(false)} title={t("feed.emojiPicker")}>
        <FlatList
          data={EMOJI_GRID as readonly string[]}
          keyExtractor={(item) => item}
          numColumns={7}
          renderItem={({ item }) => (
            <Pressable style={styles.gridItem} onPress={() => pick(item)}>
              <Text style={styles.emoji}>{item}</Text>
            </Pressable>
          )}
        />
      </Sheet>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xs,
    paddingVertical: space.xs,
  },
  item: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  gridItem: { flex: 1, height: 48, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 24 },
});
