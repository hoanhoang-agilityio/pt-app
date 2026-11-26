import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { cn } from "@/utils/cn";

// 44px circle, accent tinted into the surface with an accent ring. Both come
// from the --accent / --surface CSS vars, so it follows theme and the
// user-selected accent colour.
const BACK_BUTTON_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface))] text-accent transition hover:bg-[color-mix(in_srgb,var(--accent)_22%,var(--surface))] focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none active:scale-95 disabled:pointer-events-none disabled:opacity-50";

interface BackButtonBaseProps {
  // Defaults to the shared "Back" label.
  label?: string;
  className?: string;
}

interface BackLinkProps extends BackButtonBaseProps {
  href: string;
  onClick?: never;
}

interface BackActionProps extends BackButtonBaseProps {
  onClick: () => void;
  href?: never;
  disabled?: boolean;
}

type BackButtonProps = BackLinkProps | BackActionProps;

export const BackButton = (props: BackButtonProps) => {
  const t = useTranslations("layout.header");
  const label = props.label ?? t("back");
  const className = cn(BACK_BUTTON_CLASS, props.className);
  const icon = <ChevronLeft className="size-5" strokeWidth={2} aria-hidden />;

  if (props.href !== undefined) {
    return (
      <Link href={props.href} aria-label={label} className={className}>
        {icon}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={label}
      className={className}
    >
      {icon}
    </button>
  );
};

// Non-interactive stand-in with the same footprint, for loading screens.
export const BackButtonPlaceholder = ({
  className,
}: {
  className?: string;
}) => (
  <span aria-hidden className={cn(BACK_BUTTON_CLASS, className)}>
    <ChevronLeft className="size-5 opacity-50" strokeWidth={2} />
  </span>
);
