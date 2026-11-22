import { useTranslation } from "react-i18next";

import { EmptyState, Screen } from "@/components/ui";

// Placeholder: workouts are out of scope for the first mobile release.
export default function WorkoutsTab() {
  const { t } = useTranslation();

  return (
    <Screen>
      <EmptyState icon="barbell-outline" title={t("workouts.title")} hint={t("workouts.placeholder")} />
    </Screen>
  );
}
