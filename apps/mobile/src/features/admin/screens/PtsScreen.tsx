import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, Switch } from "react-native";

import { Button } from "@/components/ui";
import { useErrorText } from "@/lib/ui-helpers";
import { useTheme } from "@/theme";

import { createPt, setPtVerified } from "../api";
import { Banner, Field, FormSheet, ListRow, Loaded, Page, Pill, useFormError } from "../components/kit";
import { ak } from "../keys";
import { useIsSuperAdmin, usePts } from "../use-admin";

// PT accounts (super admin): list, create, verified badge.
export const PtsScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const isSuper = useIsSuperAdmin();
  const pts = usePts();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const form = useFormError();
  const create = useMutation({
    mutationFn: () => createPt({ username, password }),
    onSuccess: () => {
      setOpen(false);
      setUsername("");
      setPassword("");
      void queryClient.invalidateQueries({ queryKey: ak.pts });
    },
    onError: form.setError,
  });
  const verify = useMutation({
    mutationFn: (input: { id: number; verified: boolean }) => setPtVerified(input.id, input.verified),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ak.pts }),
    onError: (error) => Alert.alert(errorText(error)),
  });

  if (!isSuper) {
    return (
      <Page title={t("admin.pts.title")}>
        <Banner text={t("admin.forbidden")} />
      </Page>
    );
  }
  return (
    <Page
      title={t("admin.pts.title")}
      onRefresh={() => void pts.refetch()}
      refreshing={pts.isRefetching}
      headerRight={() => (
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("admin.pts.add")}
          onPress={() => {
            form.clear();
            setOpen(true);
          }}
        >
          <Ionicons name="add-circle-outline" size={26} color={theme.accent} />
        </Pressable>
      )}
    >
      <Loaded query={pts}>
        {(data) =>
          data.accounts.map((account) => (
            <ListRow
              key={account.id}
              title={account.username}
              subtitle={t("admin.pts.trainees", { count: account.traineeCount })}
              left={<Ionicons name="person-circle-outline" size={36} color={theme.muted} />}
              right={
                <>
                  {account.role === "super_admin" ? <Pill label={t("me.role.super_admin")} tone="accent" /> : null}
                  <Switch
                    accessibilityLabel={t("admin.pts.verified")}
                    value={account.verified}
                    disabled={verify.isPending}
                    onValueChange={(value) => verify.mutate({ id: account.id, verified: value })}
                    trackColor={{ true: theme.accent }}
                  />
                </>
              }
            />
          ))
        }
      </Loaded>

      <FormSheet visible={open} title={t("admin.pts.add")} onClose={() => setOpen(false)}>
        <Field
          label={t("admin.pts.username")}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          error={form.fieldError("username")}
        />
        <Field
          label={t("admin.pts.password")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          error={form.fieldError("password")}
        />
        {form.message && !form.hasFields ? <Banner text={form.message} /> : null}
        <Button
          label={t("admin.pts.create")}
          loading={create.isPending}
          disabled={username.trim() === "" || password === ""}
          onPress={() => {
            form.clear();
            create.mutate();
          }}
        />
      </FormSheet>
    </Page>
  );
};
