"use client";

import { Plus, Search, UserCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Input } from "@/components/common/Input";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD } from "@/constants/styles";
import {
  type AddAccountMode,
  AddAccountSheet,
} from "@/features/pts/components/AddAccountSheet";
import { PtAssignSelect } from "@/features/pts/components/PtAssignSelect";
import { VerifiedToggle } from "@/features/pts/components/VerifiedToggle";
import type {
  DirectoryAdmin,
  DirectoryFilter,
  DirectoryTrainee,
} from "@/features/pts/types/directory";
import { buildDirectory, countByFilter } from "@/features/pts/utils/directory";
import { cn } from "@/utils/cn";

const FILTERS: DirectoryFilter[] = ["all", "pt", "trainee", "unassigned"];

interface SheetState {
  isOpen: boolean;
  mode: AddAccountMode;
  ptId: number | null;
  name: string;
  // Remounts the sheet so each opening starts from its own defaults.
  nonce: number;
}

interface PtDirectoryProps {
  admins: DirectoryAdmin[];
  trainees: DirectoryTrainee[];
  ptOptions: { id: number; username: string }[];
}

// "PT & học viên": every account in one searchable list, trainees grouped by
// PT. Filtering runs in the browser over the lists the page loaded.
export const PtDirectory = ({
  admins,
  trainees,
  ptOptions,
}: PtDirectoryProps) => {
  const t = useTranslations("pts.directory");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DirectoryFilter>("all");
  const [sheet, setSheet] = useState<SheetState>({
    isOpen: false,
    mode: "trainee",
    ptId: null,
    name: "",
    nonce: 0,
  });

  const counts = countByFilter(admins, trainees);
  const view = buildDirectory(admins, trainees, {
    filter,
    query,
    unassignedTitle: t("unassignedGroup"),
  });
  const trimmedQuery = query.trim();
  // Whether the search finds nothing even under Tất cả.
  const isEmptyInAll =
    filter === "all"
      ? view.isEmpty
      : buildDirectory(admins, trainees, {
          filter: "all",
          query,
          unassignedTitle: t("unassignedGroup"),
        }).isEmpty;
  const hasNoOtherAccounts =
    admins.every((admin) => admin.role !== "pt") && trainees.length === 0;

  const openSheet = (
    options: Partial<Pick<SheetState, "mode" | "ptId" | "name">> = {},
  ) =>
    setSheet((current) => ({
      isOpen: true,
      mode: options.mode ?? "trainee",
      ptId: options.ptId ?? null,
      name: options.name ?? "",
      nonce: current.nonce + 1,
    }));

  const renderEmpty = () => {
    if (trimmedQuery && filter !== "all" && !isEmptyInAll) {
      // Matches exist under Tất cả: do not offer to add a duplicate.
      return (
        <p className={`${CARD} p-4 text-center text-sm text-muted`}>
          {t("noResultInFilter", { query: trimmedQuery })}
        </p>
      );
    }
    if (trimmedQuery) {
      return (
        <div className={`${CARD} space-y-3 p-4 text-center`}>
          <p className="font-semibold text-fg">
            {t("noResult", { query: trimmedQuery })}
          </p>
          <button
            type="button"
            onClick={() => openSheet({ name: trimmedQuery })}
            className={`${BUTTON_SECONDARY} w-full`}
          >
            <Plus className="size-5" aria-hidden />
            {t("addAsTrainee", { query: trimmedQuery })}
          </button>
        </div>
      );
    }
    if (filter === "unassigned") {
      return (
        <p className={`${CARD} p-4 text-center text-sm text-muted`}>
          {t("unassignedEmpty")}
        </p>
      );
    }
    return (
      <p className={`${CARD} p-4 text-center text-sm text-muted`}>
        {t("filterEmpty")}
      </p>
    );
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {t("summary", { count: counts.all })}
          </p>
          <button
            type="button"
            onClick={() => openSheet()}
            className={`${BUTTON_PRIMARY} min-h-10 px-4 text-sm`}
          >
            <Plus className="size-5" aria-hidden />
            {t("add")}
          </button>
        </div>
        <Input
          type="search"
          inputMode="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          leadingIcon={<Search className="size-5" aria-hidden />}
          clearable
        />
        <div
          role="group"
          aria-label={t("filterLabel")}
          className="flex flex-wrap gap-2"
        >
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition",
                filter === value
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line bg-surface text-fg",
              )}
            >
              {value === "unassigned" && counts.unassigned > 0 && (
                <span className="size-2 rounded-full bg-warning" aria-hidden />
              )}
              {t(`filters.${value}`)}
              <span className="text-muted">{counts[value]}</span>
            </button>
          ))}
        </div>
        {hasNoOtherAccounts && !trimmedQuery && filter === "all" && (
          <div className={`${CARD} space-y-3 p-4 text-center`}>
            <p className="font-semibold text-fg">{t("emptyTitle")}</p>
            <button
              type="button"
              onClick={() => openSheet({ mode: "pt" })}
              className={`${BUTTON_PRIMARY} w-full`}
            >
              <UserCog className="size-5" aria-hidden />
              {t("emptyAction")}
            </button>
          </div>
        )}
        {view.isEmpty && renderEmpty()}
        {view.admins.length > 0 && (
          <ul className="space-y-2">
            {view.admins.map((admin) => (
              <li
                key={admin.id}
                className={`${CARD} flex items-center gap-3 p-3`}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-semibold text-fg">
                    <span className="truncate">{admin.username}</span>
                    {admin.verified && <VerifiedBadge />}
                    {admin.role === "super_admin" && (
                      <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                        {t("superAdmin")}
                      </span>
                    )}
                  </p>
                  {admin.role === "pt" && (
                    <p className="text-sm text-muted">
                      {t("ptRole", { count: admin.traineeCount })}
                    </p>
                  )}
                </div>
                <VerifiedToggle adminId={admin.id} verified={admin.verified} />
              </li>
            ))}
          </ul>
        )}
        {view.groups.map((group) =>
          group.trainees.length === 0 && group.ptId === null ? null : (
            <section
              key={group.ptId ?? "none"}
              className="space-y-2"
              aria-label={group.title}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="min-w-0 truncate text-xs font-semibold tracking-wide text-muted uppercase">
                  {t("groupTitle", {
                    title: group.title,
                    count: group.trainees.length,
                  })}
                </h2>
                {group.ptId !== null && (
                  <button
                    type="button"
                    aria-label={t("addToGroup", { title: group.title })}
                    onClick={() => openSheet({ ptId: group.ptId })}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted transition active:bg-line"
                  >
                    <Plus className="size-5" aria-hidden />
                  </button>
                )}
              </div>
              {group.trainees.length === 0 ? (
                <p className="text-sm text-muted">{t("noTrainees")}</p>
              ) : (
                <ul className="space-y-2">
                  {group.trainees.map((trainee) => (
                    <li
                      key={trainee.id}
                      className={`${CARD} flex items-center gap-3 p-3`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-fg">
                          {trainee.name}
                        </p>
                        {trainee.email && (
                          <p className="truncate text-sm text-muted">
                            {trainee.email}
                          </p>
                        )}
                      </div>
                      <div className="w-36 shrink-0">
                        <PtAssignSelect
                          userId={trainee.id}
                          currentPtId={trainee.ptAdminId}
                          options={ptOptions}
                          label={t("pickerLabel", { name: trainee.name })}
                          isCompact
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ),
        )}
      </div>
      <AddAccountSheet
        key={sheet.nonce}
        isOpen={sheet.isOpen}
        onOpenChange={(isOpen) =>
          setSheet((current) => ({ ...current, isOpen }))
        }
        ptOptions={ptOptions}
        initialMode={sheet.mode}
        defaultPtId={sheet.ptId}
        defaultName={sheet.name}
      />
    </>
  );
};
