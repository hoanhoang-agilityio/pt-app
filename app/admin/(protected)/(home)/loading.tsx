import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageSkeleton } from "@/components/common/PageSkeleton";
import { InlineSkeleton, Skeleton } from "@/components/common/Skeleton";
import { AppHeader } from "@/components/layout/AppHeader";
import { HeaderActionsSkeleton } from "@/components/layout/HeaderActionsSkeleton";
import { ROUTES } from "@/constants/routes";
import { ICON_BUTTON, SECTION_TITLE } from "@/constants/styles";

// Dashboard. Real: title, messages link, section titles. Placeholders: the
// admin name, account menus, tiles (they depend on the role) and the users card.
// Lives in the (home) route group so it covers the dashboard only, never a
// page opened from it (a chat would otherwise flash this dashboard skeleton).
export default async function Loading() {
  const t = await getTranslations("adminPages.home");

  return (
    <PageSkeleton
      hasTabBar={false}
      header={
        <AppHeader
          eyebrow={<InlineSkeleton className="h-3 w-28" />}
          title={t("title")}
          actions={
            <>
              <Link
                href={ROUTES.ADMIN_MESSAGES}
                className={`${ICON_BUTTON} text-fg`}
                aria-label={t("tiles.messages")}
              >
                <MessageCircle className="size-5" />
              </Link>
              <HeaderActionsSkeleton />
            </>
          }
        />
      }
    >
      <section className="space-y-2" aria-labelledby="admin-actions-title">
        <h2 id="admin-actions-title" className={SECTION_TITLE}>
          {t("actions")}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      </section>
      <Skeleton className="h-28" />
    </PageSkeleton>
  );
}
