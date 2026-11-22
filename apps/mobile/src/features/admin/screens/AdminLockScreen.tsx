import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { Button, Screen, Txt } from "@/components/ui";
import { isPasscode } from "@/lib/admin-utils";
import { isApiError } from "@/lib/errors";
import { space, useTheme } from "@/theme";

import { useAuth } from "../../auth/auth-context";
import { resetPasscode, verifyPasscode } from "../api";
import { Banner, Field, useFormError } from "../components/kit";

const digits = (value: string) => value.replace(/\D/g, "").slice(0, 4);

// Shown instead of the app while the admin has a passcode and no valid unlock.
export const AdminLockScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { reloadMe, signOut } = useAuth();
  const [mode, setMode] = useState<"unlock" | "reset">("unlock");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useFormError();

  const submit = async () => {
    setBusy(true);
    form.clear();
    try {
      if (mode === "unlock") {
        await verifyPasscode(code);
      } else {
        await resetPasscode(password, code);
      }
      setCode("");
      setPassword("");
      await reloadMe();
    } catch (error) {
      setCode("");
      form.setError(error);
      // Too many wrong codes end the session on the server.
      if (isApiError(error) && error.status === 401) {
        void signOut();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.xl, gap: space.md }}
        >
          <View style={{ alignItems: "center", gap: space.sm }}>
            <Ionicons name="lock-closed-outline" size={44} color={theme.accent} />
            <Txt size={22} weight="700">
              {t("admin.lock.title")}
            </Txt>
            <Txt tone="muted" style={{ textAlign: "center" }}>
              {mode === "unlock" ? t("admin.lock.hint") : t("admin.lock.resetHint")}
            </Txt>
          </View>
          {mode === "reset" ? (
            <Field
              label={t("admin.lock.password")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          ) : null}
          <Field
            label={mode === "unlock" ? t("admin.lock.passcode") : t("admin.passcode.new")}
            value={code}
            onChangeText={(v) => setCode(digits(v))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            autoFocus={mode === "unlock"}
            onSubmitEditing={() => isPasscode(code) && void submit()}
          />
          {form.message ? <Banner text={form.message} /> : null}
          <Button
            label={mode === "unlock" ? t("admin.lock.unlock") : t("admin.lock.reset")}
            loading={busy}
            disabled={!isPasscode(code) || (mode === "reset" && password === "")}
            onPress={() => void submit()}
          />
          <Button
            variant="ghost"
            label={mode === "unlock" ? t("admin.lock.forgot") : t("common.back")}
            onPress={() => {
              form.clear();
              setCode("");
              setMode(mode === "unlock" ? "reset" : "unlock");
            }}
          />
          <Button variant="ghost" label={t("me.logout")} onPress={() => void signOut()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

// Re-reads the session when an unlock runs out, so the lock screen comes back.
export const AdminLockWatcher = () => {
  const { state, reloadMe } = useAuth();
  const until =
    state.status === "signedIn" && state.me.actor.kind === "admin" && state.me.actor.hasPasscode
      ? state.me.actor.unlockedUntil
      : null;

  useEffect(() => {
    if (!until) {
      return undefined;
    }
    const wait = new Date(until).getTime() - Date.now() + 500;
    const id = setTimeout(() => void reloadMe().catch(() => undefined), Math.max(1000, wait));

    return () => clearTimeout(id);
  }, [until, reloadMe]);
  return null;
};
