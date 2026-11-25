"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { Spinner } from "@/components/common/Spinner";
import { INPUT, INPUT_BASE, LABEL } from "@/constants/styles";
import { assignTraineePtAction } from "@/features/pts/services/pt-actions";
import { cn } from "@/utils/cn";

interface PtAssignSelectProps {
  userId: number;
  currentPtId: number | null;
  options: { id: number; username: string }[];
  // Visible label; defaults to "PT phụ trách" (translated).
  label?: string;
  // A small picker for list rows: the label is read by screen readers only.
  isCompact?: boolean;
}

// "PT phụ trách" on the trainee page (super admin only).
export const PtAssignSelect = ({
  userId,
  currentPtId,
  options,
  label,
  isCompact = false,
}: PtAssignSelectProps) => {
  const t = useTranslations("pts.ptAssign");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleChange = (value: string) => {
    startTransition(async () => {
      const result = await assignTraineePtAction(
        userId,
        value === "" ? null : Number(value),
      );

      if (result.status !== "success") {
        toast.error(result.message);
        router.refresh();
        return;
      }
      toast.success(t("assigned"));
      router.refresh();
    });
  };

  return (
    <div className="relative">
      <div className={cn("flex items-center gap-2", isCompact && "sr-only")}>
        <label htmlFor={`pt-assign-${userId}`} className={LABEL}>
          {label ?? t("label")}
        </label>
        {isPending && <Spinner size="sm" />}
      </div>
      <select
        id={`pt-assign-${userId}`}
        value={currentPtId ?? ""}
        disabled={isPending}
        aria-busy={isPending}
        onChange={(event) => handleChange(event.target.value)}
        className={
          isCompact ? cn(INPUT_BASE, "min-h-9 py-1 pr-8 pl-3 text-sm") : INPUT
        }
      >
        <option value="">
          {isCompact ? t("unassignedShort") : t("unassigned")}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.username}
          </option>
        ))}
      </select>
      {isCompact && isPending && (
        <Spinner
          size="sm"
          className="absolute top-1/2 right-7 -translate-y-1/2"
        />
      )}
    </div>
  );
};
