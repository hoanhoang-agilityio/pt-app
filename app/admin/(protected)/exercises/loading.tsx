import { getTranslations } from "next-intl/server";

import { PageSkeleton } from "@/components/common/PageSkeleton";
import { Skeleton } from "@/components/common/Skeleton";
import { AppHeader } from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";

export default async function Loading() {
  const t = await getTranslations("exerciseLibrary");

  return (
    <PageSkeleton
      hasTabBar={false}
      header={
        <AppHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          backHref={ROUTES.ADMIN}
        />
      }
    >
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-[4.5rem] w-full" />
      <Skeleton className="h-[4.5rem] w-full" />
    </PageSkeleton>
  );
}
