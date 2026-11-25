"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { BottomSheet } from "@/components/common/BottomSheet";
import { CreateMemberForm } from "@/features/members/components/CreateMemberForm";
import { CreatePtForm } from "@/features/pts/components/CreatePtForm";
import { cn } from "@/utils/cn";

export type AddAccountMode = "trainee" | "pt";

const MODES: AddAccountMode[] = ["trainee", "pt"];

interface AddAccountSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  ptOptions: { id: number; username: string }[];
  // Where the sheet opens: the role, a preselected PT, a prefilled name.
  initialMode?: AddAccountMode;
  defaultPtId?: number | null;
  defaultName?: string;
}

// "Thêm tài khoản" (super admin): a trainee gets a one-time password, a PT a
// username and a password the admin sets.
export const AddAccountSheet = ({
  isOpen,
  onOpenChange,
  ptOptions,
  initialMode = "trainee",
  defaultPtId = null,
  defaultName = "",
}: AddAccountSheetProps) => {
  const t = useTranslations("pts.addAccount");
  const [mode, setMode] = useState<AddAccountMode>(initialMode);
  const close = () => onOpenChange(false);

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange} title={t("title")}>
      <div className="space-y-4">
        <div className="space-y-2">
          <div
            role="group"
            aria-label={t("roleLabel")}
            className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1"
          >
            {MODES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "min-h-10 rounded-lg text-sm font-semibold transition",
                  mode === value ? "bg-accent text-accent-fg" : "text-muted",
                )}
              >
                {t(`roles.${value}`)}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">{t(`hints.${mode}`)}</p>
        </div>
        {mode === "trainee" ? (
          <CreateMemberForm
            ptOptions={ptOptions}
            defaultPtId={defaultPtId}
            defaultName={defaultName}
            onDone={close}
          />
        ) : (
          <CreatePtForm onDone={close} />
        )}
      </div>
    </BottomSheet>
  );
};
