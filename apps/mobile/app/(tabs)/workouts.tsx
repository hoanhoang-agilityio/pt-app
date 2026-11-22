import { useTranslation } from "react-i18next";

import { EmptyState, Screen } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { WorkoutsScreen } from "@/features/workouts/WorkoutsScreen";

// Trainees get their week of workouts; the admin side is built separately and
// keeps the placeholder until then.
export default function WorkoutsTab() {
  const { t } = useTranslation();
  const { state } = useAuth();

  if (state.status === "signedIn" && state.me.actor.kind === "user") {
    return <WorkoutsScreen />;
  }
  return (
    <Screen>
      <EmptyState icon="barbell-outline" title={t("workouts.title")} hint={t("workouts.placeholder")} />
    </Screen>
  );
}
