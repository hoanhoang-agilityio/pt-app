import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";

import { useTheme } from "@/theme";

// The root stack hides its header for nested stacks, so the first screen of a
// nested stack has no native back button. This one goes back, or to `fallback`
// when the screen was opened cold (deep link, push notification).
export const NestedBackButton = ({ fallback }: { fallback: string }) => {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("common.back")}
      hitSlop={12}
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace(fallback as string as Href);
        }
      }}
    >
      <Ionicons name="chevron-back" size={26} color={theme.fg} />
    </Pressable>
  );
};
