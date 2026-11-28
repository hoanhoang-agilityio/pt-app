import {
  Dumbbell,
  Flag,
  MessageCircle,
  Newspaper,
  NotebookPen,
  UserCog,
  Utensils,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ScrollToTopButton } from "@/components/common/ScrollToTopButton";
import { AppHeader } from "@/components/layout/AppHeader";
import { HeaderMenus } from "@/components/layout/HeaderMenus";
import { ROUTES } from "@/constants/routes";
import { ICON_BUTTON, PAGE_CONTAINER, SECTION_TITLE } from "@/constants/styles";
import { TIME_ZONE } from "@/constants/time";
import { getAvatarUrl } from "@/features/avatar/services/avatar";
import { AdminUnreadBadge } from "@/features/chat/components/UnreadBadge";
import { loadAdminAccountColor } from "@/features/chat/services/chat-profile";
import { countUnreadForAdmin } from "@/features/chat/services/chat-queries";
import { sessionOfAdmin } from "@/features/chat-groups/services/group-access";
import { countGroupUnread } from "@/features/chat-groups/services/group-queries";
import { UsersOverviewCard } from "@/features/dashboard/components/UsersOverviewCard";
import { countMembersInScope } from "@/features/dashboard/services/dashboard-queries";
import { AddMemberButton } from "@/features/members/components/AddMemberButton";
import { countOpenReports } from "@/features/social/services/report-queries";
import { adminProfilePath } from "@/features/social/utils/post-rules";
import { canPickPersonalColor } from "@/features/theme/services/theme-queries";
import { isSuperAdmin } from "@/services/admin-scope";
import { requireAdmin } from "@/services/auth-guard";
import { getTodayDate, getWeekStart } from "@/utils/week";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("adminPages.home");

  return { title: t("metaTitle") };
};

const TILE =
  "flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-2 py-3 text-center text-sm font-semibold text-fg transition active:bg-line/60";

const AdminDashboardPage = async () => {
  const admin = await requireAdmin();
  const t = await getTranslations("adminPages.home");
  const weekStart = getWeekStart(getTodayDate(TIME_ZONE));
  const isSuper = isSuperAdmin(admin);
  const [memberCounts, unreadMessages, avatarUrl, accountColor, openReports] =
    await Promise.all([
      countMembersInScope(weekStart, admin.id),
      // Trainee chats plus group chats: the badge counts both.
      Promise.all([
        countUnreadForAdmin(admin.id),
        countGroupUnread(sessionOfAdmin(admin)),
      ]).then(([chats, groups]) => chats + groups.total),
      getAvatarUrl("admin", admin.id),
      loadAdminAccountColor(admin.id),
      isSuperAdmin(admin) ? countOpenReports() : 0,
    ]);

  return (
    <>
      <AppHeader
        eyebrow={t("eyebrow", { username: admin.username })}
        title={t("title")}
        actions={
          <>
            <Link
              href={ROUTES.ADMIN_MESSAGES}
              className={`${ICON_BUTTON} relative text-fg`}
              aria-label={t("tiles.messages")}
            >
              <MessageCircle className="size-5" />
              <AdminUnreadBadge
                initialCount={unreadMessages}
                className="absolute top-1 right-1"
              />
            </Link>
            <HeaderMenus
              role="admin"
              name={admin.username}
              avatarUrl={avatarUrl}
              accountColor={accountColor}
              isPresenceHidden={admin.presenceHidden}
              canPickAppColor={await canPickPersonalColor(
                isSuper ? "super" : "pt",
              )}
              hasPasscode={admin.hasPasscode}
              profileHref={adminProfilePath("admin", admin.id)}
            />
          </>
        }
      />
      <main
        className={`${PAGE_CONTAINER} space-y-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]`}
      >
        {!isSuper && (
          <h2 className="text-lg font-bold text-fg">
            {t("workspace", { username: admin.username })}
          </h2>
        )}
        <section className="space-y-2" aria-labelledby="admin-actions-title">
          <h2 id="admin-actions-title" className={SECTION_TITLE}>
            {t("actions")}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {/* A super admin adds accounts on the "PT & học viên" page. */}
            {!isSuper && <AddMemberButton className={TILE} />}
            {isSuper && (
              <>
                <Link href={ROUTES.ADMIN_FOODS} className={TILE}>
                  <Utensils className="size-6 text-accent" aria-hidden />
                  <span>{t("tiles.foods")}</span>
                </Link>
                <Link href={ROUTES.ADMIN_PTS} className={TILE}>
                  <UserCog className="size-6 text-accent" aria-hidden />
                  <span>{t("tiles.pts")}</span>
                </Link>
                <Link
                  href={ROUTES.ADMIN_REPORTS}
                  className={`${TILE} relative`}
                >
                  <Flag className="size-6 text-accent" aria-hidden />
                  <span>{t("tiles.reports")}</span>
                  {openReports > 0 && (
                    <span className="absolute top-2 right-2 flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs leading-5 font-bold text-white">
                      {openReports > 99 ? "99+" : openReports}
                    </span>
                  )}
                </Link>
              </>
            )}
            <Link href={ROUTES.ADMIN_NOTES} className={TILE}>
              <NotebookPen className="size-6 text-accent" aria-hidden />
              <span>{t("tiles.notes")}</span>
            </Link>
            <Link href={ROUTES.ADMIN_EXERCISES} className={TILE}>
              <Dumbbell className="size-6 text-accent" aria-hidden />
              <span>{t("tiles.exercises")}</span>
            </Link>
            <Link href={ROUTES.ADMIN_SOCIAL} className={TILE}>
              <Newspaper className="size-6 text-accent" aria-hidden />
              <span>{t("tiles.social")}</span>
            </Link>
            <Link href={ROUTES.ADMIN_MESSAGES} className={`${TILE} relative`}>
              <MessageCircle className="size-6 text-accent" aria-hidden />
              <span>{t("tiles.messages")}</span>
              <AdminUnreadBadge
                initialCount={unreadMessages}
                className="absolute top-2 right-2"
              />
            </Link>
          </div>
        </section>
        <UsersOverviewCard
          count={memberCounts.memberCount}
          plannedCount={memberCounts.plannedCount}
        />
      </main>
      <ScrollToTopButton />
    </>
  );
};

export default AdminDashboardPage;
