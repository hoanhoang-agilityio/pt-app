import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Button, Txt } from "@/components/ui";
import { isPasscode } from "@/lib/admin-utils";
import { formatClock } from "@/lib/time";
import { useErrorText } from "@/lib/ui-helpers";

import { useAuth } from "../../auth/auth-context";
import { fetchHiddenUsers, revealHiddenUsers, unhideUser } from "../api";
import { Banner, Field, ListRow, Loaded, Page, useFormError } from "../components/kit";
import { ak } from "../keys";
import { useAdminActor } from "../use-admin";

// Trainees this admin hid. They only show while revealed with the passcode.
export const HiddenUsersScreen = () => {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const { reloadMe } = useAuth();
  const admin = useAdminActor();
  const [code, setCode] = useState("");
  const form = useFormError();
  const [wrong, setWrong] = useState(false);
  const list = useQuery({ queryKey: ak.hidden, queryFn: fetchHiddenUsers });
  const revealedUntil = admin?.revealedUntil ? new Date(admin.revealedUntil) : null;
  const [now] = useState(Date.now);
  const revealed = revealedUntil !== null && revealedUntil.getTime() > now;

  const reveal = useMutation({
    mutationFn: () => revealHiddenUsers(code),
    onSuccess: async (result) => {
      setCode("");
      if (!result.revealed) {
        setWrong(true);
      }
      await reloadMe().catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: ak.all });
    },
    onError: form.setError,
  });
  const unhide = useMutation({
    mutationFn: (userId: number) => unhideUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ak.all }),
    onError: (error) => Alert.alert(errorText(error)),
  });

  return (
    <Page title={t("admin.hidden.title")} onRefresh={() => void list.refetch()} refreshing={list.isRefetching}>
      <Txt size={14} tone="muted">
        {t("admin.hidden.intro")}
      </Txt>
      {revealed && revealedUntil ? (
        <Banner tone="info" text={t("admin.hidden.revealedUntil", { time: formatClock(revealedUntil) })} />
      ) : admin?.hasPasscode ? (
        <>
          <Field
            label={t("admin.hidden.passcode")}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 4))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
          />
          {wrong ? <Banner text={t("admin.hidden.wrongCode")} /> : null}
          {form.message ? <Banner text={form.message} /> : null}
          <Button
            label={t("admin.hidden.reveal")}
            loading={reveal.isPending}
            disabled={!isPasscode(code)}
            onPress={() => {
              form.clear();
              setWrong(false);
              reveal.mutate();
            }}
          />
        </>
      ) : (
        <Banner text={t("admin.hidden.needPasscode")} />
      )}
      <Loaded query={list}>
        {(data) =>
          data.users.length === 0 ? (
            <Txt tone="muted">{revealed ? t("admin.hidden.empty") : t("admin.hidden.locked")}</Txt>
          ) : (
            data.users.map((user) => (
              <ListRow
                key={user.userId}
                title={user.displayName}
                subtitle={user.displayName !== user.userName ? user.userName : undefined}
                left={<Avatar name={user.displayName} uri={user.avatarUrl} size={44} />}
                right={
                  <Button
                    label={t("admin.hidden.unhide")}
                    variant="secondary"
                    disabled={unhide.isPending}
                    onPress={() => unhide.mutate(user.userId)}
                    style={{ minHeight: 36, paddingHorizontal: 14 }}
                  />
                }
              />
            ))
          )
        }
      </Loaded>
    </Page>
  );
};
