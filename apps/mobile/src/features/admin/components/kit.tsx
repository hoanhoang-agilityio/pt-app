import { Ionicons } from "@expo/vector-icons";
import type { UseQueryResult } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState, Screen, Skeleton, Txt } from "@/components/ui";
import { isApiError } from "@/lib/errors";
import { useErrorText } from "@/lib/ui-helpers";
import { radius, space, useTheme } from "@/theme";

// Small building blocks shared by the admin screens.

export const Card = ({ children, gap = space.sm }: { children: ReactNode; gap?: number }) => {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: radius.md,
        borderColor: theme.line,
        borderWidth: StyleSheet.hairlineWidth,
        padding: space.lg,
        gap,
      }}
    >
      {children}
    </View>
  );
};

export const SectionTitle = ({ children, right }: { children: string; right?: ReactNode }) => (
  <View style={styles.sectionTitle}>
    <Txt weight="700" size={13} tone="muted" style={{ textTransform: "uppercase" }}>
      {children}
    </Txt>
    {right}
  </View>
);

export const Banner = ({ text, tone = "danger" }: { text: string; tone?: "danger" | "info" }) => {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="alert"
      style={{
        borderRadius: radius.sm,
        padding: space.md,
        backgroundColor: tone === "danger" ? `${theme.danger}22` : theme.line,
      }}
    >
      <Txt size={14} tone={tone === "danger" ? "danger" : "default"}>
        {text}
      </Txt>
    </View>
  );
};

export const Field = ({
  label,
  error,
  hint,
  ...input
}: TextInputProps & { label: string; error?: string; hint?: string }) => {
  const theme = useTheme();

  return (
    <View style={{ gap: 4 }}>
      <Txt size={13} weight="600" tone="muted">
        {label}
      </Txt>
      <TextInput
        placeholderTextColor={theme.muted}
        autoCorrect={false}
        {...input}
        style={[
          styles.input,
          {
            color: theme.fg,
            backgroundColor: theme.bg,
            borderColor: error ? theme.danger : theme.line,
          },
          input.multiline && { minHeight: 84, textAlignVertical: "top" },
          input.style,
        ]}
      />
      {error ? (
        <Txt size={12} tone="danger">
          {error}
        </Txt>
      ) : hint ? (
        <Txt size={12} tone="muted">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
};

export const Chip = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) => {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.surface,
          borderColor: selected ? theme.accent : theme.line,
        },
      ]}
    >
      <Txt size={13} weight="600" style={{ color: selected ? theme.accentFg : theme.fg }}>
        {label}
      </Txt>
    </Pressable>
  );
};

export const ChipRow = ({ children }: { children: ReactNode }) => (
  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>{children}</View>
);

export const Segmented = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) => {
  const theme = useTheme();

  return (
    <View style={[styles.segment, { backgroundColor: theme.line }]}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
          style={[styles.segmentItem, value === option.value && { backgroundColor: theme.surface }]}
        >
          <Txt size={13} weight="600" tone={value === option.value ? "default" : "muted"}>
            {option.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
};

export const ListRow = ({
  title,
  subtitle,
  left,
  right,
  onPress,
  danger,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) => {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.line },
        pressed && { opacity: 0.6 },
      ]}
    >
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt weight="600" tone={danger ? "danger" : "default"} numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt size={13} tone="muted" numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={theme.muted} /> : null)}
    </Pressable>
  );
};

export const Pill = ({ label, tone = "muted" }: { label: string; tone?: "muted" | "accent" | "danger" | "success" }) => {
  const theme = useTheme();
  const color =
    tone === "accent" ? theme.accent : tone === "danger" ? theme.danger : tone === "success" ? theme.success : theme.muted;

  return (
    <View style={{ borderRadius: radius.pill, borderWidth: 1, borderColor: color, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Txt size={11} weight="600" style={{ color }}>
        {label}
      </Txt>
    </View>
  );
};

export const ProgressBar = ({ percent }: { percent: number }) => {
  const theme = useTheme();

  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.line, overflow: "hidden" }}>
      <View
        style={{
          height: 6,
          width: `${Math.max(0, Math.min(100, percent))}%`,
          backgroundColor: theme.accent,
        }}
      />
    </View>
  );
};

// A bottom sheet for forms: lifts above the keyboard and scrolls.
export const FormSheet = ({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Pressable
          accessibilityLabel={title}
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }]}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: insets.bottom + space.lg },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.line }]} />
          <Txt weight="700" size={17} style={{ marginBottom: space.md }}>
            {title}
          </Txt>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: space.md, paddingBottom: space.md }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// Error state of a form: a banner message plus per-field messages from a 400.
export const useFormError = () => {
  const errorText = useErrorText();
  const [error, setError] = useState<unknown>(null);

  const fieldError = useCallback(
    (name: string) => (isApiError(error) ? error.fieldErrors?.[name] : undefined),
    [error],
  );

  return {
    error,
    setError,
    clear: () => setError(null),
    message: error ? errorText(error) : null,
    fieldError,
    // A banner only when no field carries the message.
    hasFields: isApiError(error) && !!error.fieldErrors,
  };
};

const styles = StyleSheet.create({
  sectionTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: space.sm,
  },
  input: {
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 16,
  },
  chip: {
    minHeight: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  segment: { flexDirection: "row", borderRadius: radius.md, padding: 3 },
  segmentItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: space.md },
});

// A scrolling admin page with a native header and pull to refresh.
export const Page = ({
  title,
  children,
  onRefresh,
  refreshing = false,
  headerRight,
  scroll = true,
}: {
  title: string;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  headerRight?: () => ReactNode;
  scroll?: boolean;
}) => (
  <Screen edges={["bottom"]}>
    <Stack.Screen options={{ title, headerShown: true, headerRight }} />
    {scroll ? (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 }}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
        }
      >
        {children}
      </ScrollView>
    ) : (
      children
    )}
  </Screen>
);

export const SkeletonList = ({ rows = 5 }: { rows?: number }) => (
  <View style={{ gap: space.lg }}>
    {Array.from({ length: rows }, (_, i) => (
      <View key={i} style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
        <Skeleton width={44} height={44} round />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="55%" height={12} />
          <Skeleton width="80%" height={10} />
        </View>
      </View>
    ))}
  </View>
);

// Loading, error and ready states of one query.
export const Loaded = <T,>({
  query,
  children,
  skeleton,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
}) => {
  const errorText = useErrorText();

  if (query.isPending) {
    return <>{skeleton ?? <SkeletonList />}</>;
  }
  if (query.isError) {
    return (
      <View style={{ minHeight: 240 }}>
        <ErrorState message={errorText(query.error)} onRetry={() => void query.refetch()} />
      </View>
    );
  }
  return <>{children(query.data)}</>;
};
