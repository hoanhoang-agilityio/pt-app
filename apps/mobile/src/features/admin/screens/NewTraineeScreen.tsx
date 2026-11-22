import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Txt } from "@/components/ui";
import { space } from "@/theme";

import { createTrainee } from "../api";
import { Banner, Chip, ChipRow, Field, Page, useFormError } from "../components/kit";
import { OneTimePassword } from "../components/OneTimePassword";
import { ak } from "../keys";
import { useIsSuperAdmin, usePts } from "../use-admin";

export const NewTraineeScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isSuper = useIsSuperAdmin();
  const pts = usePts();
  const form = useFormError();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ptId, setPtId] = useState<number | null>(null);
  const [created, setCreated] = useState<{ id: number; email: string; password: string } | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createTrainee({ name, email, ...(isSuper && ptId !== null ? { ptAdminId: ptId } : {}) }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ak.all });
      setCreated({ id: result.id, email: result.email, password: result.password });
    },
    onError: form.setError,
  });

  const done = () => {
    const id = created?.id;

    setCreated(null);
    if (id) {
      router.replace(`/admin/trainee/${id}` as string as Href);
    }
  };

  return (
    <Page title={t("admin.members.new")}>
      <Field
        label={t("admin.members.name")}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        error={form.fieldError("name")}
      />
      <Field
        label={t("admin.members.email")}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        error={form.fieldError("email")}
      />
      {isSuper ? (
        <>
          <Txt size={13} weight="600" tone="muted">
            {t("admin.members.pt")}
          </Txt>
          <ChipRow>
            <Chip label={t("admin.members.noPt")} selected={ptId === null} onPress={() => setPtId(null)} />
            {pts.data?.accounts.map((account) => (
              <Chip
                key={account.id}
                label={account.username}
                selected={ptId === account.id}
                onPress={() => setPtId(account.id)}
              />
            ))}
          </ChipRow>
        </>
      ) : null}
      {form.message && !form.hasFields ? <Banner text={form.message} /> : null}
      <Button
        label={t("admin.members.create")}
        loading={create.isPending}
        disabled={name.trim() === "" || email.trim() === ""}
        onPress={() => {
          form.clear();
          create.mutate();
        }}
        style={{ marginTop: space.sm }}
      />
      <OneTimePassword
        visible={created !== null}
        title={t("admin.members.created")}
        email={created?.email}
        password={created?.password ?? ""}
        onClose={done}
      />
    </Page>
  );
};
