import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ScrollToTopButton } from "@/components/common/ScrollToTopButton";
import { WeekNavigator } from "@/components/common/WeekNavigator";
import { AppHeader } from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";
import { CARD, PAGE_CONTAINER } from "@/constants/styles";
import { TIME_ZONE } from "@/constants/time";
import { listUnreadByTraineeForAdmin } from "@/features/chat/services/chat-queries";
import { MemberProgressList } from "@/features/dashboard/components/MemberProgressList";
import { PtFilterSelect } from "@/features/dashboard/components/PtFilterSelect";
import { getMemberProgress } from "@/features/dashboard/services/dashboard-queries";
import { parsePtFilter } from "@/features/dashboard/utils/pt-filter";
import { toMemberRows } from "@/features/dashboard/utils/summary";
import { listPtOptions } from "@/features/pts/services/pt-queries";
import { listActiveRestrictions } from "@/features/restrictions/services/restriction-queries";
import { isSuperAdmin } from "@/services/admin-scope";
import { requireAdmin } from "@/services/auth-guard";
import { getAdminUserPath } from "@/utils/routes";
import { readSearchParam } from "@/utils/search-params";
import { getRequestTime } from "@/utils/time";
import { getTodayDate, resolveSchedule } from "@/utils/week";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("adminPages.users");

  return { title: t("metaTitle") };
};

const getMemberHref = (memberId: number, weekStart: string) =>
  `${getAdminUserPath(memberId)}?${new URLSearchParams({ week: weekStart })}`;

const AdminUsersPage = async ({ searchParams }: PageProps<"/admin/users">) => {
  const admin = await requireAdmin();
  const t = await getTranslations("adminPages.users");
  const locale = await getLocale();
  const query = await searchParams;
  const today = getTodayDate(TIME_ZONE);
  const now = getRequestTime();
  const schedule = resolveSchedule(
    { week: readSearchParam(query.week) },
    today,
  );
  const isSuper = isSuperAdmin(admin);
  // Only a super admin can filter by PT; a PT is already scoped to their own.
  const ptFilter = isSuper ? parsePtFilter(readSearchParam(query.pt)) : "all";
  const [ptOptions, members, unreadByTrainee] = await Promise.all([
    isSuper ? listPtOptions() : Promise.resolve([]),
    getMemberProgress(schedule.weekStart, admin.id, ptFilter),
    listUnreadByTraineeForAdmin(admin.id),
  ]);
  const restrictions = await listActiveRestrictions(
    members.map((member) => member.id),
  );
  const rows = toMemberRows(members, {
    weekStart: schedule.weekStart,
    timeZone: TIME_ZONE,
    now,
    getHref: getMemberHref,
    locale,
    unreadByUserId: new Map(
      unreadByTrainee.map((row) => [row.userId, row.unread]),
    ),
    restrictionByUserId: new Map(
      [...restrictions].map(([userId, restriction]) => [
        userId,
        restriction.level,
      ]),
    ),
  });

  return (
    <>
      <AppHeader
        backHref={ROUTES.ADMIN}
        eyebrow={t("eyebrow")}
        title={t("title", { count: members.length })}
      />
      <main
        className={`${PAGE_CONTAINER} space-y-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]`}
      >
        <div className={`${CARD} p-4`}>
          <WeekNavigator
            basePath={ROUTES.ADMIN_USERS}
            weekStart={schedule.weekStart}
            selectedDate={schedule.selectedDate}
            today={today}
          />
        </div>
        {isSuper && (
          <PtFilterSelect value={String(ptFilter)} options={ptOptions} />
        )}
        <MemberProgressList
          members={rows}
          hasPasscode={admin.hasPasscode}
          isPtShown={isSuper}
        />
      </main>
      <ScrollToTopButton />
    </>
  );
};

export default AdminUsersPage;
