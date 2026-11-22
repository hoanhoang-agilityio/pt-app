import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Spinner, Txt } from "@/components/ui";
import { useErrorText } from "@/lib/ui-helpers";

import { fetchFoodGroups } from "../api";
import { ak } from "../keys";
import { useFoodSearch } from "../use-foods";
import { Banner, Chip, ChipRow, Field, FormSheet, ListRow } from "./kit";

// Pick one food of the library to add to a meal.
export const FoodPicker = ({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (foodId: number) => void;
}) => {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const groups = useQuery({ queryKey: ak.foodGroups, queryFn: fetchFoodGroups, enabled: visible });
  const foods = useFoodSearch(q, group, visible);

  useEffect(() => {
    const id = setTimeout(() => setQ(text), 300);

    return () => clearTimeout(id);
  }, [text]);

  const items = foods.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <FormSheet visible={visible} title={t("admin.mealPlan.addFood")} onClose={onClose}>
      <Field label={t("admin.foods.search")} value={text} onChangeText={setText} />
      <ChipRow>
        <Chip label={t("admin.foods.allGroups")} selected={group === ""} onPress={() => setGroup("")} />
        {(groups.data?.groups ?? []).map((entry) => (
          <Chip
            key={entry.group}
            label={t(`admin.foods.group.${entry.group}`)}
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
          subtitle={t("admin.foods.macros", {
            kcal: food.kcal,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
          })}
          onPress={() => onPick(food.id)}
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
    </FormSheet>
  );
};
