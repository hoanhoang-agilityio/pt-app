import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { Button, Txt } from "@/components/ui";
import { isPasscode } from "@/lib/admin-utils";
import { confirmAction } from "@/lib/ui-helpers";

import { useAuth } from "../../auth/auth-context";
import { changePasscode, lockNow, removePasscode, setPasscode } from "../api";
import { Banner, Card, Field, Page, SectionTitle, useFormError } from "../components/kit";
import { useAdminActor } from "../use-admin";

const digits = (value: string) => value.replace(/\D/g, "").slice(0, 4);

// Set, change, remove the 4-digit passcode, or lock right now.
export const PasscodeScreen = () => {
  const { t } = useTranslation();
  const { reloadMe, signOut } = useAuth();
  const admin = useAdminActor();
  const hasPasscode = admin?.hasPasscode ?? false;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNext, setConfirmNext] = useState("");
  const form = useFormError();
  const finish = async (message: string) => {
    setCurrent("");
    setNext("");
    setConfirmNext("");
    await reloadMe().catch(() => undefined);
    Alert.alert(message);
  };
  const setNew = useMutation({
    mutationFn: () => setPasscode(next),
    onSuccess: () => finish(t("admin.passcode.saved")),
    onError: form.setError,
  });
  const change = useMutation({
    mutationFn: () => changePasscode(current, next),
    onSuccess: () => finish(t("admin.passcode.changed")),
    onError: form.setError,
  });
  const remove = useMutation({
    mutationFn: () => removePasscode(current),
    onSuccess: () => finish(t("admin.passcode.removed")),
    onError: form.setError,
  });
  const lock = useMutation({
    mutationFn: lockNow,
    onSuccess: () => reloadMe(),
    onError: form.setError,
  });
  const matches = next === confirmNext;

  if (!admin) {
    return <Page title={t("admin.passcode.title")}>{null}</Page>;
  }
  return (
    <Page title={t("admin.passcode.title")}>
      <Txt tone="muted" size={14}>
        {hasPasscode ? t("admin.passcode.on") : t("admin.passcode.off")}
      </Txt>
      {hasPasscode ? (
        <Field
          label={t("admin.passcode.current")}
          value={current}
          onChangeText={(v) => setCurrent(digits(v))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
        />
      ) : null}
      <Field
        label={hasPasscode ? t("admin.passcode.new") : t("admin.passcode.set")}
        value={next}
        onChangeText={(v) => setNext(digits(v))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        hint={t("admin.passcode.hint")}
      />
      <Field
        label={t("admin.passcode.confirm")}
        value={confirmNext}
        onChangeText={(v) => setConfirmNext(digits(v))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        error={confirmNext !== "" && !matches ? t("admin.passcode.mismatch") : undefined}
      />
      {form.message ? <Banner text={form.message} /> : null}
      <Button
        label={hasPasscode ? t("admin.passcode.change") : t("admin.passcode.enable")}
        loading={setNew.isPending || change.isPending}
        disabled={!isPasscode(next) || !matches || (hasPasscode && !isPasscode(current))}
        onPress={() => {
          form.clear();
          if (hasPasscode) {
            change.mutate();
          } else {
            setNew.mutate();
          }
        }}
      />

      {hasPasscode ? (
        <>
          <SectionTitle>{t("admin.passcode.more")}</SectionTitle>
          <Card gap={12}>
            <Button
              variant="secondary"
              label={t("admin.passcode.lockNow")}
              loading={lock.isPending}
              onPress={() => {
                form.clear();
                lock.mutate();
              }}
            />
            <Button
              variant="danger"
              label={t("admin.passcode.remove")}
              loading={remove.isPending}
              disabled={!isPasscode(current)}
              onPress={() =>
                confirmAction({
                  title: t("admin.passcode.removeTitle"),
                  message: t("admin.passcode.removeBody"),
                  confirmLabel: t("admin.passcode.remove"),
                  cancelLabel: t("common.cancel"),
                  destructive: true,
                  onConfirm: () => {
                    form.clear();
                    remove.mutate();
                  },
                })
              }
            />
          </Card>
          <Txt size={12} tone="muted">
            {t("admin.passcode.wrongWarning")}
          </Txt>
        </>
      ) : null}
      <Button variant="ghost" label={t("me.logout")} onPress={() => void signOut()} />
    </Page>
  );
};
