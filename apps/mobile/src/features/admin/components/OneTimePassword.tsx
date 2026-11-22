import { useTranslation } from "react-i18next";
import { Share, View } from "react-native";

import { Button, Txt } from "@/components/ui";
import { radius, space, useTheme } from "@/theme";

import { Banner, FormSheet } from "./kit";

// A generated password is shown once: the PT sends it to the trainee now.
export const OneTimePassword = ({
  visible,
  title,
  email,
  password,
  onClose,
}: {
  visible: boolean;
  title: string;
  email?: string | null;
  password: string;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const message = email ? `${email}\n${password}` : password;

  return (
    <FormSheet visible={visible} title={title} onClose={onClose}>
      <Banner tone="info" text={t("admin.password.once")} />
      {email ? (
        <Txt size={14} tone="muted" selectable>
          {email}
        </Txt>
      ) : null}
      <View
        style={{
          borderRadius: radius.md,
          backgroundColor: theme.bg,
          padding: space.lg,
          alignItems: "center",
        }}
      >
        <Txt size={22} weight="700" selectable style={{ letterSpacing: 1 }}>
          {password}
        </Txt>
      </View>
      <Button
        label={t("admin.password.share")}
        onPress={() => void Share.share({ message }).catch(() => undefined)}
      />
      <Button label={t("common.close")} variant="secondary" onPress={onClose} />
    </FormSheet>
  );
};
