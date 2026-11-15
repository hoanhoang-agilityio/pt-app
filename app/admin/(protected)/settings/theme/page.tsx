import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ScrollToTopButton } from "@/components/common/ScrollToTopButton";
import { AppHeader } from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";
import { PAGE_CONTAINER } from "@/constants/styles";
import { ThemeSettings } from "@/features/theme/components/ThemeSettings";
import { getThemeOverview } from "@/features/theme/services/theme-queries";
import { requireSuperAdmin } from "@/services/auth-guard";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("theme");

  return { title: t("title") };
};

// Super admin only: a PT is redirected to the admin home by requireSuperAdmin.
const AdminThemePage = async () => {
  const admin = await requireSuperAdmin();
  const t = await getTranslations("theme");
  const overview = await getThemeOverview(admin.id);

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
        <p className="text-sm text-muted">{t("description")}</p>
        <ThemeSettings saved={overview} />
      </main>
      <ScrollToTopButton />
    </>
  );
};

export default AdminThemePage;
