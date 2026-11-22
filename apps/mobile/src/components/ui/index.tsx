import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { radius, space, useTheme } from "@/theme";

// Small shared primitives: Screen, Txt, Button, IconButton, states, Divider.

export const Screen = ({
  children,
  edges = ["top"],
  style,
}: {
  children: ReactNode;
  edges?: ("top" | "bottom" | "left" | "right")[];
  style?: StyleProp<ViewStyle>;
}) => {
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={edges}
      style={[{ flex: 1, backgroundColor: theme.bg }, style]}
    >
      {children}
    </SafeAreaView>
  );
};

type TxtProps = TextProps & {
  tone?: "default" | "muted" | "accent" | "danger";
  size?: number;
  weight?: "400" | "500" | "600" | "700";
  style?: StyleProp<TextStyle>;
};

export const Txt = ({
  tone = "default",
  size = 15,
  weight = "400",
  style,
  ...rest
}: TxtProps) => {
  const theme = useTheme();
  const color =
    tone === "muted"
      ? theme.muted
      : tone === "accent"
        ? theme.accent
        : tone === "danger"
          ? theme.danger
          : theme.fg;

  return <Text {...rest} style={[{ color, fontSize: size, fontWeight: weight }, style]} />;
};

export const Button = ({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  style?: StyleProp<ViewStyle>;
}) => {
  const theme = useTheme();
  const bg =
    variant === "primary"
      ? theme.accent
      : variant === "danger"
        ? theme.danger
        : variant === "secondary"
          ? theme.surface
          : "transparent";
  const fg =
    variant === "primary"
      ? theme.accentFg
      : variant === "danger"
        ? "#fff"
        : variant === "ghost"
          ? theme.accent
          : theme.fg;
  const off = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: variant === "secondary" ? theme.line : "transparent",
          opacity: off ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: 15, fontWeight: "600" }}>{label}</Text>
      )}
    </Pressable>
  );
};

export const IconButton = ({
  name,
  onPress,
  label,
  color,
  size = 22,
  badge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  badge?: number;
}) => {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={styles.iconButton}
    >
      <Ionicons name={name} size={size} color={color ?? theme.fg} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <Text style={{ color: theme.accentFg, fontSize: 10, fontWeight: "700" }}>
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

export const Divider = () => {
  const theme = useTheme();

  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.line }} />;
};

export const EmptyState = ({
  icon = "chatbubbles-outline",
  title,
  hint,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
}) => {
  const theme = useTheme();

  return (
    <View style={styles.state}>
      <Ionicons name={icon} size={40} color={theme.muted} />
      <Txt weight="600" style={{ textAlign: "center" }}>
        {title}
      </Txt>
      {hint ? (
        <Txt tone="muted" size={14} style={{ textAlign: "center" }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
};

export const ErrorState = ({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.state} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={40} color="#999" />
      <Txt weight="600">{t("common.errorTitle")}</Txt>
      <Txt tone="muted" size={14} style={{ textAlign: "center" }}>
        {message ?? t("common.errorGeneric")}
      </Txt>
      {onRetry ? <Button label={t("common.retry")} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
};

export const Skeleton = ({
  width,
  height,
  round = false,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  round?: boolean;
  style?: StyleProp<ViewStyle>;
}) => {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          width,
          height,
          backgroundColor: theme.line,
          borderRadius: round ? radius.pill : radius.sm,
        },
        style,
      ]}
    />
  );
};

export const Spinner = () => {
  const theme = useTheme();

  return (
    <View style={{ padding: space.lg }}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    padding: space.xl,
  },
});
