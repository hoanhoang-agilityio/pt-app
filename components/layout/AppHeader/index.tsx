import clsx from "clsx";
import type { ReactNode } from "react";

import { BackButton } from "@/components/common/BackButton";
import { Skeleton } from "@/components/common/Skeleton";
import { PAGE_CONTAINER } from "@/constants/styles";

interface AppHeaderProps {
  // ReactNode so loading screens can put a skeleton where data-driven text goes.
  title: ReactNode;
  eyebrow?: ReactNode;
  backHref?: string;
  // Loading screens: the back target depends on data, show a placeholder.
  isBackLoading?: boolean;
  actions?: ReactNode;
}

export const AppHeader = ({
  title,
  eyebrow,
  backHref,
  isBackLoading = false,
  actions,
}: AppHeaderProps) => {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)]">
      <div className={clsx(PAGE_CONTAINER, "flex min-h-16 items-center gap-2")}>
        {backHref && <BackButton href={backHref} />}
        {!backHref && isBackLoading && (
          <Skeleton className="size-11 shrink-0 rounded-full" />
        )}
        <div className="min-w-0 flex-1 py-2">
          {eyebrow && (
            <p className="truncate text-xs font-medium text-muted">{eyebrow}</p>
          )}
          <h1 className="truncate text-lg leading-tight font-bold text-fg">
            {title}
          </h1>
        </div>
        {actions && <div className="-mr-3 flex items-center">{actions}</div>}
      </div>
    </header>
  );
};
