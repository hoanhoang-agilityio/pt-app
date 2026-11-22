import { View } from "react-native";

import { AuthImage } from "@/components/AuthImage";
import { Txt } from "@/components/ui";
import { useTheme } from "@/theme";

export const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }
  const first = Array.from(parts[0])[0] ?? "?";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";

  return `${first}${last}`.toUpperCase();
};

export const Avatar = ({
  name,
  uri,
  size = 40,
}: {
  name: string;
  uri?: string | null;
  size?: number;
}) => {
  const theme = useTheme();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.line,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {uri ? (
        <AuthImage
          uri={uri}
          accessibilityLabel={name}
          style={{ width: size, height: size }}
          contentFit="cover"
        />
      ) : (
        <Txt weight="600" size={size * 0.38} tone="muted">
          {initialsOf(name)}
        </Txt>
      )}
    </View>
  );
};
