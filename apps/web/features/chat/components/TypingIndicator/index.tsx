import { useTranslations } from "next-intl";

import { WaveDots } from "@/components/common/WaveDots";

interface TypingIndicatorProps {
  name: string;
}

// Peer bubble with three dots and "{name} đang nhập…". The dots bounce; under
// prefers-reduced-motion they stay still. The text is the accessible label.
export const TypingIndicator = ({ name }: TypingIndicatorProps) => {
  const t = useTranslations("chat.typing");

  return (
    <div className="mt-3 flex items-center gap-2" role="status">
      <WaveDots className="rounded-2xl rounded-bl-md bg-line px-3 py-3" />
      <span className="text-xs text-muted">{t("label", { name })}</span>
    </div>
  );
};
