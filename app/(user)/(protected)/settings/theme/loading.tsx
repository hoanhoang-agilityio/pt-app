import { getTranslations } from "next-intl/server";

import { PageSkeleton } from "@/components/common/PageSkeleton";
import { Skeleton } from "@/components/common/Skeleton";
import { AppHeader } from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";

export default async function Loading() {
  const t = await getTranslations("theme");

  return (
    <PageSkeleton
      header={
        <AppHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          backHref={ROUTES.WORKOUTS}
        />
      }
    >
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-72 w-full" />
    </PageSkeleton>
  );
}
