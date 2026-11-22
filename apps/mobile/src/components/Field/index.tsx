import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";

import { Txt } from "@/components/ui";
import { radius, space, useTheme } from "@/theme";

// A labelled text input with an optional error line.
export const Field = ({
  label,
  error,
  style,
  ...rest
}: TextInputProps & { label?: string; error?: string | null }) => {
  const theme = useTheme();

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Txt size={13} weight="600" tone="muted">
          {label}
        </Txt>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.muted}
        {...rest}
        style={[
          styles.input,
          {
            color: theme.fg,
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : theme.line,
          },
          rest.multiline && { minHeight: 90, textAlignVertical: "top", paddingTop: space.md },
          style,
        ]}
      />
      {error ? (
        <Txt size={12} tone="danger" accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: space.md,
    fontSize: 16,
  },
});
