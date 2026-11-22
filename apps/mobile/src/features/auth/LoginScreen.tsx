import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { Button, Screen, Txt } from "@/components/ui";
import { useErrorText } from "@/lib/ui-helpers";
import { radius, space, useTheme } from "@/theme";

import { useAuth } from "./auth-context";

// Email + password for trainees; username + password for PTs (toggle). Google
// sign-in is intentionally not part of the app.
export const LoginScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { state, signIn } = useAuth();
  const errorText = useErrorText();
  const [isAdmin, setAdmin] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (login.trim() === "" || password === "") {
      setError(t(isAdmin ? "auth.fieldsRequiredAdmin" : "auth.fieldsRequiredUser"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(isAdmin ? "admin" : "trainee", login.trim(), password);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.surface, borderColor: theme.line, color: theme.fg },
  ];
  const ended = state.status === "signedOut" && state.sessionEnded;

  return (
    <Screen edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Txt size={28} weight="700">
            {t("auth.title")}
          </Txt>
          <Txt tone="muted">{t("auth.subtitle")}</Txt>
          {ended ? (
            <Txt tone="danger" size={14} accessibilityRole="alert">
              {t("auth.sessionEnded")}
            </Txt>
          ) : null}
          <View style={{ gap: space.sm }}>
            <Txt weight="600" size={14}>
              {t(isAdmin ? "auth.username" : "auth.email")}
            </Txt>
            <TextInput
              value={login}
              onChangeText={setLogin}
              placeholder={isAdmin ? undefined : t("auth.emailPlaceholder")}
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={isAdmin ? "default" : "email-address"}
              textContentType={isAdmin ? "username" : "emailAddress"}
              autoComplete={isAdmin ? "username" : "email"}
              style={inputStyle}
              returnKeyType="next"
            />
          </View>
          <View style={{ gap: space.sm }}>
            <Txt weight="600" size={14}>
              {t("auth.password")}
            </Txt>
            <View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                autoComplete="current-password"
                style={[...inputStyle, { paddingRight: 90 }]}
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(showPassword ? "auth.hidePassword" : "auth.showPassword")}
                onPress={() => setShowPassword((value) => !value)}
                style={styles.eye}
              >
                <Txt tone="accent" size={13} weight="600">
                  {t(showPassword ? "auth.hidePassword" : "auth.showPassword")}
                </Txt>
              </Pressable>
            </View>
          </View>
          {error ? (
            <Txt tone="danger" size={14} accessibilityRole="alert">
              {error}
            </Txt>
          ) : null}
          <Button
            label={t(busy ? "auth.submitting" : "auth.submit")}
            onPress={() => void submit()}
            loading={busy}
          />
          <Button
            variant="ghost"
            label={t(isAdmin ? "auth.userToggle" : "auth.adminToggle")}
            onPress={() => {
              setAdmin((value) => !value);
              setLogin("");
              setError(null);
            }}
          />
          {!isAdmin ? (
            <Txt tone="muted" size={13} style={{ textAlign: "center" }}>
              {t("auth.forgot")}
            </Txt>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg, flexGrow: 1, justifyContent: "center" },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontSize: 16,
  },
  eye: { position: "absolute", right: space.md, top: 0, bottom: 0, justifyContent: "center" },
});
