import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { describeError, isApiError } from "./errors";

// Text for any thrown error, in the app language.
export const useErrorText = () => {
  const { t } = useTranslation();

  return useCallback(
    (error: unknown) => {
      if (isApiError(error) && error.kind !== "http") {
        return t("common.errorOffline");
      }
      return describeError(error, t("common.errorGeneric"), (message, ref) =>
        t("common.errorRef", { message, ref }),
      );
    },
    [t],
  );
};

export const confirmAction = (options: {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) => {
  Alert.alert(options.title, options.message, [
    { text: options.cancelLabel, style: "cancel" },
    {
      text: options.confirmLabel,
      style: options.destructive ? "destructive" : "default",
      onPress: options.onConfirm,
    },
  ]);
};

export const newKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

// RFC 4122 v4 for ids the API validates as UUID (chat clientId).
export const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);

    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
