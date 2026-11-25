import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ROUTES } from "@/constants/routes";

interface UsersOverviewCardProps {
  count: number;
  plannedCount: number;
}

export const UsersOverviewCard = async ({
  count,
  plannedCount,
}: UsersOverviewCardProps) => {
  const t = await getTranslations("adminPages.home.usersCard");

  return (
    <Link
      href={ROUTES.ADMIN_USERS}
      className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-fg transition outline-none focus-visible:ring-2 focus-visible:ring-accent active:bg-line/60"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          <Users className="size-4" aria-hidden />
          {t("label")}
        </p>
        <p className="mt-2 text-2xl leading-none font-bold text-fg tabular-nums">
          {count}
        </p>
        <p className="mt-1.5 line-clamp-2 text-xs text-muted">
          {t("hint", { planned: plannedCount })}
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
    </Link>
  );
};
