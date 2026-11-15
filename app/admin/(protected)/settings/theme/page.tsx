import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ScrollToTopButton } from "@/components/common/ScrollToTopButton";
import { AppHeader } from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";
import { PAGE_CONTAINER } from "@/constants/styles";
import { MyThemeSettings } from "@/features/theme/components/MyThemeSettings";
import { ThemeSettings } from "@/features/theme/components/ThemeSettings";
import {
  getPersonalTheme,
  getThemeOverview,
} from "@/features/theme/services/theme-queries";
import { isSuperAdmin } from "@/services/admin-scope";
import { requireAdmin } from "@/services/auth-guard";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("theme");

  return { title: t("title") };
};

// The super admin sees the four scopes and the two locks; a PT sees a
// personal-only picker, or is sent back while the super admin locked PTs.
const AdminThemePage = async () => {
  const admin = await requireAdmin();
  const t = await getTranslations("theme");
  const isSuper = isSuperAdmin(admin);
  const [overview, personal] = await Promise.all([
    isSuper ? getThemeOverview(admin.id) : null,
    isSuper ? null : getPersonalTheme({ kind: "admin", id: admin.id }),
  ]);

  if (personal?.locked) {
    redirect(ROUTES.ADMIN);
  }

  return (
    <>
      <AppHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        backHref={ROUTES.ADMIN}
      />
      <main
        className={`${PAGE_CONTAINER} space-y-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]`}
      >
        <p className="text-sm text-muted">
          {overview ? t("description") : t("personal.description")}
        </p>
        {overview ? (
          <ThemeSettings saved={overview} locks={overview.locks} />
        ) : (
          <MyThemeSettings audience="admin" saved={personal?.saved ?? null} />
        )}
      </main>
      <ScrollToTopButton />
    </>
  );
};

export default AdminThemePage;
