import { PageSkeleton } from "@/components/common/PageSkeleton";
import { InlineSkeleton, SkeletonList } from "@/components/common/Skeleton";
import { WeekStripSkeleton } from "@/components/common/WeekStripSkeleton";
import { AppHeader } from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";

// Users list. Real: back link. Placeholders: the title (it carries the count),
// the week navigator and the member rows.
export default function Loading() {
  return (
    <PageSkeleton
      hasTabBar={false}
      header={
        <AppHeader
          backHref={ROUTES.ADMIN}
          eyebrow={<InlineSkeleton className="h-3 w-16" />}
          title={<InlineSkeleton className="h-5 w-32" />}
        />
      }
    >
      <WeekStripSkeleton variant="navigator" />
      <SkeletonList rows={4} />
    </PageSkeleton>
  );
}
