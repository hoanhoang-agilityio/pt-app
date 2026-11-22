import { FOOD_GROUP_VALUES, type FoodResponse } from "@pt/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch, View } from "react-native";

import { Button, Txt } from "@/components/ui";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { space, useTheme } from "@/theme";

import { archiveFood, createFood, fetchFood, type FoodPayload, updateFood } from "../api";
import { Banner, Chip, ChipRow, Field, Loaded, Page, useFormError } from "../components/kit";
import { ak } from "../keys";
import { useIsSuperAdmin } from "../use-admin";

type FoodForm = {
  name: string;
  group: string;
  state: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  servingLabel: string;
  servingGrams: string;
  nameEn: string;
  nameZh: string;
  source: string;
  confirmed: boolean;
};

const EMPTY: FoodForm = {
  name: "",
  group: "",
  state: "",
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
  servingLabel: "",
  servingGrams: "",
  nameEn: "",
  nameZh: "",
  source: "",
  confirmed: false,
};

const fromFood = (food: FoodResponse): FoodForm => ({
  name: food.name,
  group: food.group,
  state: food.state ?? "",
  kcal: String(food.kcal),
  protein: String(food.protein),
  carbs: String(food.carbs),
  fat: String(food.fat),
  fiber: food.fiber === null ? "" : String(food.fiber),
  servingLabel: food.servingLabel ?? "",
  servingGrams: food.servingGrams === null ? "" : String(food.servingGrams),
  nameEn: food.nameEn ?? "",
  nameZh: food.nameZh ?? "",
  source: food.source,
  confirmed: false,
});

const FoodFormView = ({ food }: { food: FoodResponse | null }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const form = useFormError();
  const [values, setValues] = useState<FoodForm>(food ? fromFood(food) : EMPTY);
  const set = <K extends keyof FoodForm>(key: K, value: FoodForm[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ak.foodsAll });
    void queryClient.invalidateQueries({ queryKey: ak.foodGroups });
    router.back();
  };
  const save = useMutation({
    mutationFn: () => {
      const body: FoodPayload = { ...values };

      return food ? updateFood(food.id, body) : createFood(body);
    },
    onSuccess: done,
    onError: form.setError,
  });
  const archive = useMutation({
    mutationFn: () => archiveFood(food?.id ?? 0),
    onSuccess: done,
    onError: form.setError,
  });
  const field = (key: keyof FoodForm, label: string, numeric = false, hint?: string) => (
    <Field
      label={label}
      hint={hint}
      value={String(values[key])}
      onChangeText={(text) => set(key, text as never)}
      keyboardType={numeric ? "decimal-pad" : "default"}
      error={form.fieldError(key)}
    />
  );

  return (
    <>
      {field("name", t("admin.foods.name"))}
      <Txt size={13} weight="600" tone="muted">
        {t("admin.foods.groupLabel")}
      </Txt>
      <ChipRow>
        {FOOD_GROUP_VALUES.map((value) => (
          <Chip
            key={value}
            label={t(`admin.foods.group.${value}`)}
            selected={values.group === value}
            onPress={() => set("group", value)}
          />
        ))}
      </ChipRow>
      {form.fieldError("group") ? (
        <Txt size={12} tone="danger">
          {form.fieldError("group")}
        </Txt>
      ) : null}
      <Txt size={13} weight="600" tone="muted">
        {t("admin.foods.state")}
      </Txt>
      <ChipRow>
        {(["", "raw", "cooked"] as const).map((value) => (
          <Chip
            key={value || "none"}
            label={t(`admin.foods.states.${value || "none"}`)}
            selected={values.state === value}
            onPress={() => set("state", value)}
          />
        ))}
      </ChipRow>
      <Txt size={12} tone="muted">
        {t("admin.foods.per100")}
      </Txt>
      <View style={{ flexDirection: "row", gap: space.md }}>
        <View style={{ flex: 1 }}>{field("kcal", "kcal", true)}</View>
        <View style={{ flex: 1 }}>{field("fiber", t("admin.foods.fiber"), true)}</View>
      </View>
      <View style={{ flexDirection: "row", gap: space.md }}>
        <View style={{ flex: 1 }}>{field("protein", "Protein", true)}</View>
        <View style={{ flex: 1 }}>{field("carbs", "Carb", true)}</View>
        <View style={{ flex: 1 }}>{field("fat", "Fat", true)}</View>
      </View>
      <View style={{ flexDirection: "row", gap: space.md }}>
        <View style={{ flex: 1 }}>{field("servingLabel", t("admin.foods.servingLabel"))}</View>
        <View style={{ flex: 1 }}>{field("servingGrams", t("admin.foods.servingGrams"), true)}</View>
      </View>
      {field("nameEn", t("admin.foods.nameEn"))}
      {field("nameZh", t("admin.foods.nameZh"))}
      {field("source", t("admin.foods.source"))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Switch
          value={values.confirmed}
          onValueChange={(value) => set("confirmed", value)}
          trackColor={{ true: theme.accent }}
        />
        <Txt size={13} style={{ flex: 1 }}>
          {t("admin.foods.confirmed")}
        </Txt>
      </View>
      {form.message && !form.hasFields ? <Banner text={form.message} /> : null}
      <Button
        label={t("common.save")}
        loading={save.isPending}
        onPress={() => {
          form.clear();
          save.mutate();
        }}
      />
      {food ? (
        <Button
          label={t("admin.foods.archive")}
          variant="danger"
          loading={archive.isPending}
          onPress={() =>
            confirmAction({
              title: t("admin.foods.archiveTitle"),
              message: t("admin.foods.archiveBody"),
              confirmLabel: t("admin.foods.archive"),
              cancelLabel: t("common.cancel"),
              destructive: true,
              onConfirm: () => archive.mutate(),
            })
          }
        />
      ) : null}
      {archive.isError && !form.message ? <Banner text={errorText(archive.error)} /> : null}
    </>
  );
};

const EditFood = ({ id }: { id: number }) => {
  const query = useQuery({ queryKey: ak.food(id), queryFn: () => fetchFood(id) });

  return <Loaded query={query}>{(food) => <FoodFormView food={food} />}</Loaded>;
};

// "new" creates a food, a number edits it (super admin only).
export const FoodFormScreen = () => {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string }>();
  const isSuper = useIsSuperAdmin();
  const isNew = params.id === "new";

  return (
    <Page title={isNew ? t("admin.foods.add") : t("admin.foods.edit")}>
      {!isSuper ? (
        <Banner text={t("admin.forbidden")} />
      ) : isNew ? (
        <FoodFormView food={null} />
      ) : (
        <EditFood id={Number(params.id)} />
      )}
    </Page>
  );
};
