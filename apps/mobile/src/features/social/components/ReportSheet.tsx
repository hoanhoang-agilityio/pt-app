import {
  SOCIAL_REPORT_REASON_CODES,
  SOCIAL_REPORT_REASON_MAX_LENGTH,
  type SocialReportReasonCode,
  type SocialReportTargetKind,
} from "@pt/contracts";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";

import { Sheet } from "@/components/Sheet";
import { Button, Txt } from "@/components/ui";
import { useErrorText } from "@/lib/ui-helpers";
import { radius, space, useTheme } from "@/theme";

import { fileReport } from "../api";

// "Report": a reason from the fixed list plus an optional note. Used for
// posts, comments, users and chat messages (the reason is required for chat).
export const ReportSheet = ({
  visible,
  onClose,
  targetKind,
  targetId,
}: {
  visible: boolean;
  onClose: () => void;
  targetKind: SocialReportTargetKind;
  targetId: number;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const [code, setCode] = useState<SocialReportReasonCode | null>(null);
  const [note, setNote] = useState("");
  const send = useMutation({
    mutationFn: () =>
      fileReport({
        targetKind,
        targetId,
        reasonCode: code ?? undefined,
        reason: note.trim(),
      }),
    onSuccess: () => {
      setCode(null);
      setNote("");
      onClose();
      Alert.alert(t("report.sent"));
    },
    onError: (error) => Alert.alert(errorText(error)),
  });

  return (
    <Sheet visible={visible} onClose={onClose} title={t(`report.titles.${targetKind}`)}>
      <Txt tone="muted" size={13} style={{ marginBottom: space.sm }}>
        {t("report.description")}
      </Txt>
      {SOCIAL_REPORT_REASON_CODES.map((value) => (
        <Pressable
          key={value}
          accessibilityRole="radio"
          accessibilityState={{ selected: code === value }}
          onPress={() => setCode(value)}
          style={[
            styles.option,
            { borderColor: code === value ? theme.accent : theme.line },
          ]}
        >
          <Txt weight={code === value ? "600" : "400"}>{t(`report.reasons.${value}`)}</Txt>
        </Pressable>
      ))}
      <TextInput
        value={note}
        onChangeText={setNote}
        maxLength={SOCIAL_REPORT_REASON_MAX_LENGTH}
        multiline
        placeholder={t("report.noteLabel")}
        placeholderTextColor={theme.muted}
        style={[styles.note, { color: theme.fg, borderColor: theme.line }]}
      />
      <View style={{ marginTop: space.md }}>
        <Button
          label={t("report.send")}
          loading={send.isPending}
          disabled={code === null && (targetKind === "message" || targetKind === "group_message")}
          onPress={() => send.mutate()}
        />
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  option: {
    minHeight: 46,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    marginBottom: 6,
  },
  note: {
    minHeight: 70,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.sm,
    textAlignVertical: "top",
    fontSize: 15,
  },
});
