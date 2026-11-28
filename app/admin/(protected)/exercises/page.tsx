import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ScrollToTopButton } from "@/components/common/ScrollToTopButton";
import { AppHeader } from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";
import { PAGE_CONTAINER } from "@/constants/styles";
import { ExerciseLibraryView } from "@/features/exercise-library/components/ExerciseLibraryView";
import { countCustomExercises } from "@/features/exercise-library/services/exercise-queries";
import { requireAdmin } from "@/services/auth-guard";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("exerciseLibrary");

  return { title: t("metaTitle") };
};

const AdminExercisesPage = async () => {
  const admin = await requireAdmin();
  const t = await getTranslations("exerciseLibrary");
  // Land on the admin's own exercises when there are some, else on the library.
  const hasCustom = (await countCustomExercises(admin.id)) > 0;

  return (
    <>
      <AppHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        backHref={ROUTES.ADMIN}
      />
      <main
        className={`${PAGE_CONTAINER} pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]`}
      >
        <ExerciseLibraryView initialTab={hasCustom ? "mine" : "library"} />
      </main>
      <ScrollToTopButton />
    </>
  );
};

export default AdminExercisesPage;
