import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ScrollToTopButton } from "@/components/common/ScrollToTopButton";
import { AppHeader } from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";
import { PAGE_CONTAINER } from "@/constants/styles";
import { PtDirectory } from "@/features/pts/components/PtDirectory";
import {
  listAdminAccounts,
  listPtOptions,
  listWorkspaceTrainees,
} from "@/features/pts/services/pt-queries";
import { requireSuperAdmin } from "@/services/auth-guard";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("adminPages.pts");

  return { title: t("metaTitle") };
};

const AdminPtsPage = async () => {
  await requireSuperAdmin();
  const t = await getTranslations("adminPages.pts");

  const [accounts, ptOptions, trainees] = await Promise.all([
    listAdminAccounts(),
    listPtOptions(),
    listWorkspaceTrainees(),
  ]);

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
        <PtDirectory
          admins={accounts}
          trainees={trainees}
          ptOptions={ptOptions}
        />
      </main>
      <ScrollToTopButton />
    </>
  );
};

export default AdminPtsPage;
