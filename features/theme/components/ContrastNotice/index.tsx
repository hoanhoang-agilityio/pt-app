import clsx from "clsx";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { BUTTON_SECONDARY } from "@/constants/styles";
import type { ContrastReport } from "@/features/theme/utils/contrast";

interface ContrastNoticeProps {
  report: ContrastReport;
  disabled?: boolean;
  onFix: () => void;
}

const ratio = (value: number) => value.toFixed(1);

// WCAG badge: green when the pick passes, a warning with a "fix lightness"
// button when the accent is too faint on the light page. Never blocks saving.
export const ContrastNotice = ({
  report,
  disabled = false,
  onFix,
}: ContrastNoticeProps) => {
  const t = useTranslations("theme.contrast");

  return (
    <div
      className={clsx(
        "space-y-2 rounded-xl border p-3",
        report.isOk ? "border-success/40" : "border-warning/50",
      )}
    >
      <p
        role="status"
        className={clsx(
          "flex items-center gap-2 text-sm font-semibold",
          report.isOk ? "text-success" : "text-warning",
        )}
      >
        {report.isOk ? (
          <CircleCheck className="size-5 shrink-0" aria-hidden />
        ) : (
          <TriangleAlert className="size-5 shrink-0" aria-hidden />
        )}
        {report.isOk ? t("ok") : t("warning")}
      </p>
      <ul className="space-y-0.5 text-xs text-muted">
        <li>
          {t("foreground", {
            ratio: ratio(report.foregroundRatio),
            min: "4.5",
          })}
        </li>
        <li>{t("light", { ratio: ratio(report.lightRatio), min: "3" })}</li>
        <li>{t("dark", { ratio: ratio(report.darkRatio) })}</li>
      </ul>
      {!report.isOk && (
        <button
          type="button"
          onClick={onFix}
          disabled={disabled}
          className={`${BUTTON_SECONDARY} w-full`}
        >
          {t("fix")}
        </button>
      )}
    </div>
  );
};
