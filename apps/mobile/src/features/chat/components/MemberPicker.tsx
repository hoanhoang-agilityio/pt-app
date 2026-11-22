import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Txt } from "@/components/ui";
import { filterCandidates, toggleSelection } from "@/lib/group-rules";
import { radius, space, useTheme } from "@/theme";

import type { GroupCandidatesResponseLike } from "./picker-types";

// Search box plus trainees (and, for a super admin, PTs) as checkboxes, capped
// at the group's free places.
export const MemberPicker = ({
  candidates,
  selected,
  onChange,
  max,
}: {
  candidates: GroupCandidatesResponseLike;
  selected: ReadonlySet<string>;
  onChange: (next: ReadonlySet<string>) => void;
  max: number;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const trainees = useMemo(
    () => filterCandidates(candidates.trainees, query),
    [candidates.trainees, query],
  );
  const pts = useMemo(
    () => filterCandidates(candidates.pts, query),
    [candidates.pts, query],
  );
  const full = selected.size >= max;

  if (candidates.trainees.length + candidates.pts.length === 0) {
    return (
      <Txt tone="muted" style={{ textAlign: "center", padding: space.lg }}>
        {t("groupMgmt.noCandidates")}
      </Txt>
    );
  }
  const renderList = (title: string, items: typeof trainees) =>
    items.length === 0 ? null : (
      <View>
        <Txt
          tone="muted"
          size={13}
          weight="600"
          style={{ marginVertical: space.sm }}
        >
          {title}
        </Txt>
        {items.map((item) => {
          const checked = selected.has(item.key);

          return (
            <Pressable
              key={item.key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled: !checked && full }}
              disabled={!checked && full}
              onPress={() => onChange(toggleSelection(selected, item.key, max))}
              style={[styles.row, !checked && full && { opacity: 0.5 }]}
            >
              <Ionicons
                name={checked ? "checkbox" : "square-outline"}
                size={24}
                color={checked ? theme.accent : theme.muted}
              />
              <Avatar name={item.name} size={32} />
              <Txt style={{ flex: 1 }} numberOfLines={1}>
                {item.name}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    );

  return (
    <View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t("groupMgmt.search")}
        placeholderTextColor={theme.muted}
        style={[styles.input, { color: theme.fg, borderColor: theme.line }]}
      />
      <Txt tone="muted" size={13} style={{ marginTop: space.sm }}>
        {t("groupMgmt.selected", { count: selected.size, max })}
      </Txt>
      {trainees.length + pts.length === 0 ? (
        <Txt tone="muted" style={{ textAlign: "center", padding: space.lg }}>
          {t("groupMgmt.noMatches")}
        </Txt>
      ) : null}
      {renderList(t("groupMgmt.trainees"), trainees)}
      {renderList(t("groupMgmt.pts"), pts)}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 48,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    fontSize: 16,
  },
});
