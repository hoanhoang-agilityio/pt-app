import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AppHeader } from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";
import { PAGE_CONTAINER } from "@/constants/styles";
import { MyThemeSettings } from "@/features/theme/components/MyThemeSettings";
import { getPersonalTheme } from "@/features/theme/services/theme-queries";
import { requireUser } from "@/services/auth-guard";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("theme");

  return { title: t("title") };
};

// A trainee's own app color. Sent back to the workouts while the super admin
// has locked color changes for trainees.
const UserThemePage = async () => {
  const user = await requireUser();
  const { saved, locked } = await getPersonalTheme({
    kind: "user",
    id: user.id,
  });

  if (locked) {
    redirect(ROUTES.WORKOUTS);
  }
  const t = await getTranslations("theme");

  return (
    <>
      <AppHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        backHref={ROUTES.WORKOUTS}
      />
      <main
        className={`${PAGE_CONTAINER} space-y-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6rem)]`}
      >
        <p className="text-sm text-muted">{t("personal.description")}</p>
        <MyThemeSettings audience="user" saved={saved} />
      </main>
    </>
  );
};

export default UserThemePage;
