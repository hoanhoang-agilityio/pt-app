import { getTranslations } from "next-intl/server";

import { PageSkeleton } from "@/components/common/PageSkeleton";
import { Skeleton, SkeletonList } from "@/components/common/Skeleton";
import { AppHeader } from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";

export default async function Loading() {
  const t = await getTranslations("trainingNotes");

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
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-12 w-full" />
      <SkeletonList rows={3} />
    </PageSkeleton>
  );
}
