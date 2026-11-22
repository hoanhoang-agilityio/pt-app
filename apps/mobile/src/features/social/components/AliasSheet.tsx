import { ALIAS_MAX_LENGTH } from "@pt/contracts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, TextInput, View } from "react-native";

import { Sheet } from "@/components/Sheet";
import { Button, Txt } from "@/components/ui";
import { useErrorText } from "@/lib/ui-helpers";
import { radius, space, useTheme } from "@/theme";

import { useSetAlias } from "../hooks";

// Private nickname ("Zalo style"): only I see what I call this person. Blank
// removes it. `targetKey` is "user:<id>", "admin:<id>" or "pt".
export const AliasSheet = ({
  visible,
  onClose,
  targetKey,
  realName,
  current,
}: {
  visible: boolean;
  onClose: () => void;
  targetKey: string;
  realName: string;
  current: string;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const save = useSetAlias();
  const [text, setText] = useState(current);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(current);
    }
  }, [visible, current]);

  return (
    <Sheet visible={visible} onClose={onClose} title={t("alias.sheetTitle", { name: realName })}>
      <Txt tone="muted" size={13}>
        {t("alias.hint")}
      </Txt>
      <TextInput
        value={text}
        onChangeText={setText}
        maxLength={ALIAS_MAX_LENGTH}
        placeholder={realName}
        placeholderTextColor={theme.muted}
        style={[styles.input, { color: theme.fg, borderColor: theme.line }]}
      />
      <View style={{ gap: space.sm }}>
        <Button
          label={t("common.save")}
          loading={save.isPending}
          onPress={() =>
            save.mutate(
              { key: targetKey, alias: text },
              { onSuccess: onClose, onError: (error) => Alert.alert(errorText(error)) },
            )
          }
        />
        {current ? (
          <Button
            label={t("alias.remove")}
            variant="secondary"
            disabled={save.isPending}
            onPress={() =>
              save.mutate(
                { key: targetKey, alias: "" },
                { onSuccess: onClose, onError: (error) => Alert.alert(errorText(error)) },
              )
            }
          />
        ) : null}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    marginVertical: space.md,
    fontSize: 16,
  },
});
