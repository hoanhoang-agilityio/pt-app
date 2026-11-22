import { USER_PASSWORD_MAX, USER_PASSWORD_MIN } from "@pt/contracts";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";

import { Field } from "@/components/Field";
import { Button, Screen, Txt } from "@/components/ui";
import { validatePasswordChange } from "@/lib/password-rules";
import { useErrorText } from "@/lib/ui-helpers";
import { space } from "@/theme";

import { changePassword } from "./api";

// Changes the trainee's password; the API signs the other devices out.
export const ChangePasswordScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const problem = validatePasswordChange(current, next, repeat, USER_PASSWORD_MIN, USER_PASSWORD_MAX);

    if (problem) {
      setError(t(`acct.password.${problem}`, { min: USER_PASSWORD_MIN }));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await changePassword(current, next);
      Alert.alert(t("acct.password.changed"));
      router.back();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={["bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
          <Field
            label={t("acct.password.current")}
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
          />
          <Field
            label={t("acct.password.new")}
            value={next}
            onChangeText={setNext}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <Field
            label={t("acct.password.confirm")}
            value={repeat}
            onChangeText={setRepeat}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            error={error}
          />
          <Txt size={12} tone="muted">
            {t("acct.password.hint")}
          </Txt>
          <Button label={t("acct.password.submit")} loading={busy} onPress={() => void submit()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};
