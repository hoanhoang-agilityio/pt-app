import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { EmptyState, ErrorState, IconButton,Screen, Txt } from "@/components/ui";
import { useErrorText } from "@/lib/ui-helpers";
import { radius, space, useTheme } from "@/theme";

import { useAuth } from "../../auth/auth-context";
import { fetchTrainees, revealHiddenUsers } from "../api";
import { Chip, ChipRow, ListRow, SkeletonList } from "../components/kit";
import { ak } from "../keys";
import { useAdminActor, useIsSuperAdmin, usePts } from "../use-admin";

// Debounced copy of a value, for the search box.
const useDebounced = (value: string, ms = 300) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);

    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
};

export const MembersScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const isSuper = useIsSuperAdmin();
  const pts = usePts();
  const [text, setText] = useState("");
  const [pt, setPt] = useState<number | null>(null);
  const q = useDebounced(text);
  const queryClient = useQueryClient();
  const { reloadMe } = useAuth();
  const hasPasscode = useAdminActor()?.hasPasscode ?? false;
  const list = useQuery({
    queryKey: ak.trainees(q, pt),
    queryFn: () => fetchTrainees(q, pt ?? undefined),
  });
  // Like the web: typing the 4-digit passcode in the search box reveals the
  // hidden trainees for a while (a wrong code is a quiet "no match").
  useEffect(() => {
    if (!hasPasscode || !/^\d{4}$/.test(q)) {
      return;
    }
    void revealHiddenUsers(q)
      .then(async (result) => {
        if (result.revealed) {
          setText("");
          await reloadMe();
          await queryClient.invalidateQueries({ queryKey: ak.all });
        }
      })
      .catch(() => undefined);
  }, [q, hasPasscode, reloadMe, queryClient]);
  const ptName = (id: number | null) =>
    id === null ? t("admin.members.noPt") : (pts.data?.accounts.find((a) => a.id === id)?.username ?? "");

  return (
    <Screen>
      <View style={styles.header}>
        <Txt size={24} weight="700" style={{ flex: 1 }}>
          {t("admin.members.title")}
        </Txt>
        <IconButton
          name="person-add-outline"
          label={t("admin.members.add")}
          color={theme.accent}
          onPress={() => router.push("/admin/trainee/new" as string as Href)}
        />
      </View>
      <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
        <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Ionicons name="search" size={18} color={theme.muted} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t("admin.members.search")}
            placeholderTextColor={theme.muted}
            autoCorrect={false}
            returnKeyType="search"
            style={{ flex: 1, color: theme.fg, fontSize: 16, minHeight: 42 }}
          />
        </View>
        {isSuper && (pts.data?.accounts.length ?? 0) > 0 ? (
          <ChipRow>
            <Chip label={t("admin.dashboard.allPts")} selected={pt === null} onPress={() => setPt(null)} />
            {pts.data?.accounts.map((account) => (
              <Chip
                key={account.id}
                label={account.username}
                selected={pt === account.id}
                onPress={() => setPt(account.id)}
              />
            ))}
          </ChipRow>
        ) : null}
      </View>
      <FlatList
        data={list.data?.trainees ?? []}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, padding: space.lg }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
        renderItem={({ item }) => (
          <ListRow
            title={item.displayName}
            subtitle={isSuper ? ptName(item.ptAdminId) : item.displayName !== item.name ? item.name : undefined}
            left={<Avatar name={item.displayName} uri={item.avatarUrl} size={44} />}
            onPress={() => router.push(`/admin/trainee/${item.id}` as string as Href)}
          />
        )}
        ListEmptyComponent={
          list.isPending ? (
            <SkeletonList />
          ) : list.isError ? (
            <ErrorState message={errorText(list.error)} onRetry={() => void list.refetch()} />
          ) : (
            <EmptyState icon="people-outline" title={t("admin.members.empty")} hint={q ? undefined : t("admin.members.emptyHint")} />
          )
        }
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.md,
  },
});
