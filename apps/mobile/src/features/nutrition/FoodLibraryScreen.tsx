import type { FoodGroup, FoodResponse } from "@pt/contracts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, View } from "react-native";

import { Chips } from "@/components/Chips";
import { Field } from "@/components/Field";
import { EmptyState, ErrorState, Screen, Skeleton, Spinner, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { formatGrams, localizeFoodName, scaleFood } from "@/lib/nutrition-model";
import { useErrorText } from "@/lib/ui-helpers";
import { space, useTheme } from "@/theme";

import { useFoodGroups, useFoodSearch } from "./hooks";

const FoodRow = ({ food, grams }: { food: FoodResponse; grams: number }) => {
  const { t } = useTranslation();
  const locale = currentLocale();
  const scaled = scaleFood(food, grams);

  return (
    <View style={{ paddingVertical: space.md, gap: 2 }}>
      <Txt weight="600">
        {localizeFoodName(food, locale)}
        {food.state ? <Txt tone="muted">{` (${t(`nutri.state.${food.state}`)})`}</Txt> : null}
      </Txt>
      <Txt size={13} tone="muted">
        {`${scaled.kcal} kcal · P ${formatGrams(scaled.protein, locale)} · C ${formatGrams(scaled.carbs, locale)} · F ${formatGrams(scaled.fat, locale)}`}
      </Txt>
      {food.servingLabel && food.servingGrams ? (
        <Txt size={12} tone="muted">
          {t("nutri.library.serving", { label: food.servingLabel, grams: formatGrams(food.servingGrams, locale) })}
        </Txt>
      ) : null}
    </View>
  );
};

// The shared food library: search (accent-free, localized) and group chips;
// values per 100 g.
export const FoodLibraryScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const locale = currentLocale();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [group, setGroup] = useState<FoodGroup | null>(null);
  const groups = useFoodGroups();
  const search = useFoodSearch(debounced, group, locale);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Screen edges={["bottom"]}>
      <View style={{ padding: space.lg, gap: space.md }}>
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder={t("nutri.library.search")}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <Chips
          scroll
          value={group ?? "all"}
          onChange={(value) => setGroup(value === "all" ? null : (value as FoodGroup))}
          options={[
            { value: "all", label: t("nutri.library.all") },
            ...(groups.data?.groups ?? []).map((entry) => ({
              value: entry.group,
              label: `${t(`nutri.group.${entry.group}`)} (${entry.count})`,
            })),
          ]}
        />
        <Txt size={12} tone="muted">
          {t("nutri.library.per100")}
        </Txt>
      </View>
      {search.isPending ? (
        <View style={{ padding: space.lg, gap: space.md }}>
          <Skeleton height={14} width="60%" />
          <Skeleton height={12} width="40%" />
        </View>
      ) : search.isError ? (
        <ErrorState message={errorText(search.error)} onRetry={() => void search.refetch()} />
      ) : (
        <FlatList
          data={search.foods}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: space.lg, flexGrow: 1 }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: theme.line }} />
          )}
          renderItem={({ item }) => <FoodRow food={item} grams={100} />}
          onEndReached={() => {
            if (search.hasNextPage && !search.isFetchingNextPage) {
              void search.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={search.isFetchingNextPage ? <Spinner /> : undefined}
          ListEmptyComponent={
            <EmptyState icon="restaurant-outline" title={t("nutri.log.noResults")} hint={t("nutri.library.empty")} />
          }
        />
      )}
    </Screen>
  );
};

