import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";

import { Button, Spinner, Txt } from "@/components/ui";
import { useErrorText } from "@/lib/ui-helpers";
import { useTheme } from "@/theme";

import { fetchFoodGroups } from "../api";
import { Banner, Chip, ChipRow, Field, ListRow, Page } from "../components/kit";
import { ak } from "../keys";
import { useIsSuperAdmin } from "../use-admin";
import { useFoodSearch } from "../use-foods";

// Food library (super admin, like the web): search, filter, open one to edit.
export const FoodsScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const isSuper = useIsSuperAdmin();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const groups = useQuery({ queryKey: ak.foodGroups, queryFn: fetchFoodGroups, enabled: isSuper });
  const foods = useFoodSearch(q, group, isSuper);

  useEffect(() => {
    const id = setTimeout(() => setQ(text), 300);

    return () => clearTimeout(id);
  }, [text]);

  if (!isSuper) {
    return (
      <Page title={t("admin.foods.title")}>
        <Banner text={t("admin.forbidden")} />
      </Page>
    );
  }
  const items = foods.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Page
      title={t("admin.foods.title")}
      refreshing={foods.isRefetching && !foods.isFetchingNextPage}
      onRefresh={() => void foods.refetch()}
      headerRight={() => (
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("admin.foods.add")}
          onPress={() => router.push("/admin/foods/new" as string as Href)}
        >
          <Ionicons name="add-circle-outline" size={26} color={theme.accent} />
        </Pressable>
      )}
    >
      <Field label={t("admin.foods.search")} value={text} onChangeText={setText} />
      <ChipRow>
        <Chip label={t("admin.foods.allGroups")} selected={group === ""} onPress={() => setGroup("")} />
        {(groups.data?.groups ?? []).map((entry) => (
          <Chip
            key={entry.group}
            label={`${t(`admin.foods.group.${entry.group}`)} (${entry.count})`}
            selected={group === entry.group}
            onPress={() => setGroup(entry.group)}
          />
        ))}
      </ChipRow>
      {foods.isError ? <Banner text={errorText(foods.error)} /> : null}
      {foods.isPending ? <Spinner /> : null}
      {items.map((food) => (
        <ListRow
          key={food.id}
          title={food.name}
          subtitle={`${t(`admin.foods.group.${food.group}`)} · ${t("admin.foods.macros", {
            kcal: food.kcal,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
          })}`}
          onPress={() => router.push(`/admin/foods/${food.id}` as string as Href)}
        />
      ))}
      {!foods.isPending && items.length === 0 ? <Txt tone="muted">{t("admin.foods.empty")}</Txt> : null}
      {foods.hasNextPage ? (
        <Button
          variant="secondary"
          label={t("common.loadMore")}
          loading={foods.isFetchingNextPage}
          onPress={() => void foods.fetchNextPage()}
        />
      ) : null}
    </Page>
  );
};
