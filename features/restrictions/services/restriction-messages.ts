import "server-only";

import { TIME_ZONE } from "@/constants/time";
import type { ActiveRestriction } from "@/features/restrictions/types/restriction";
import {
  getActiveLocale,
  getErrorsTranslator,
} from "@/services/localize-message";
import { formatShortDateTime } from "@/utils/time";

// The login refusal of a suspended trainee: the end time (or "permanent") and
// the reason the super admin wrote, in the language of the request.
export const describeSuspension = async (restriction: ActiveRestriction) => {
  const [t, locale] = await Promise.all([
    getErrorsTranslator(),
    getActiveLocale(),
  ]);

  return restriction.until === null
    ? t("toasts.suspendedForever", { reason: restriction.reason })
    : t("toasts.suspendedUntil", {
        until: formatShortDateTime(restriction.until, TIME_ZONE, locale),
        reason: restriction.reason,
      });
};
