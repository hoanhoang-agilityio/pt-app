import { Ionicons } from "@expo/vector-icons";
import { CHAT_COLOR_KEYS } from "@pt/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { type Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, Switch, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Button, Txt } from "@/components/ui";
import { jpegDataUrl } from "@/lib/admin-utils";
import { PhotoPermissionError,pickPhotos } from "@/lib/photos";
import { useErrorText } from "@/lib/ui-helpers";
import { space, useTheme } from "@/theme";

import { fetchAdminProfile, removeAdminAvatar, setAdminAvatar, setAdminChatColor, setPresenceHidden } from "../api";
import { ListRow, SectionTitle } from "../components/kit";
import { ak } from "../keys";
import { useAdminActor } from "../use-admin";

const COLORS: Record<(typeof CHAT_COLOR_KEYS)[number], string> = {
  orange: "#e8590c",
  red: "#dc2626",
  pink: "#db2777",
  purple: "#9333ea",
  indigo: "#4f46e5",
  blue: "#2563eb",
  teal: "#0d9488",
  green: "#16a34a",
};

// Square 256 px JPEG of a picked photo, as a data URL under the 80 KB cap.
const prepareAvatar = async (): Promise<string | null> => {
  const [photo] = await pickPhotos(1);

  if (!photo) {
    return null;
  }
  const side = Math.min(photo.width, photo.height);

  for (const quality of [0.8, 0.6, 0.4]) {
    const context = ImageManipulator.manipulate(photo.uri);

    context.crop({
      originX: Math.floor((photo.width - side) / 2),
      originY: Math.floor((photo.height - side) / 2),
      width: side,
      height: side,
    });
    context.resize({ width: 256, height: 256 });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });

    if (saved.base64 && saved.base64.length * 0.75 <= 78 * 1024) {
      return jpegDataUrl(saved.base64);
    }
  }
  throw new Error("avatar too large");
};

// The admin part of the Me tab: profile, passcode, hidden trainees and tools.
export const AdminMeSection = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const admin = useAdminActor();
  const profile = useQuery({ queryKey: ak.me, queryFn: fetchAdminProfile, enabled: admin !== null });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ak.me });
  const open = (path: string) => router.push(path as string as Href);
  const onError = (error: unknown) => Alert.alert(errorText(error));

  const avatar = useMutation({
    mutationFn: async () => {
      const dataUrl = await prepareAvatar();

      if (dataUrl) {
        await setAdminAvatar(dataUrl);
      }
    },
    onSuccess: refresh,
    onError: (error) =>
      Alert.alert(error instanceof PhotoPermissionError ? t("admin.me.photoPermission") : errorText(error)),
  });
  const clearAvatar = useMutation({ mutationFn: removeAdminAvatar, onSuccess: refresh, onError });
  const color = useMutation({
    mutationFn: (value: string | null) => setAdminChatColor(value),
    onSuccess: refresh,
    onError,
  });
  const presence = useMutation({
    mutationFn: (hidden: boolean) => setPresenceHidden(hidden),
    onSuccess: refresh,
    onError,
  });

  if (!admin) {
    return null;
  }
  const data = profile.data;
  const isSuper = admin.role === "super_admin";

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Avatar name={admin.username} uri={data?.avatarUrl} size={56} />
        <View style={{ flex: 1, flexDirection: "row", gap: space.sm }}>
          <Button
            label={t("admin.me.changePhoto")}
            variant="secondary"
            loading={avatar.isPending}
            onPress={() => avatar.mutate()}
            style={{ flex: 1, minHeight: 40 }}
          />
          {data?.avatarUrl ? (
            <Button
              label={t("admin.me.removePhoto")}
              variant="ghost"
              loading={clearAvatar.isPending}
              onPress={() => clearAvatar.mutate()}
              style={{ minHeight: 40 }}
            />
          ) : null}
        </View>
      </View>

      <SectionTitle>{t("admin.me.chatColor")}</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("admin.me.defaultColor")}
          accessibilityState={{ selected: !data?.chatColor }}
          onPress={() => color.mutate(null)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: !data?.chatColor ? theme.fg : theme.line,
            backgroundColor: theme.accent,
          }}
        />
        {CHAT_COLOR_KEYS.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={key}
            accessibilityState={{ selected: data?.chatColor === key }}
            onPress={() => color.mutate(key)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: data?.chatColor === key ? theme.fg : "transparent",
              backgroundColor: COLORS[key],
            }}
          />
        ))}
      </View>

      <ListRow
        title={t("admin.me.hidePresence")}
        subtitle={t("admin.me.hidePresenceHint")}
        right={
          <Switch
            value={data?.presenceHidden ?? admin.presenceHidden}
            disabled={presence.isPending}
            onValueChange={(value) => presence.mutate(value)}
            trackColor={{ true: theme.accent }}
          />
        }
      />
      <ListRow
        title={t("admin.passcode.title")}
        subtitle={admin.hasPasscode ? t("admin.passcode.on") : t("admin.passcode.off")}
        left={<Ionicons name="keypad-outline" size={22} color={theme.accent} />}
        onPress={() => open("/admin/me/passcode")}
      />
      <ListRow
        title={t("admin.hidden.title")}
        left={<Ionicons name="eye-off-outline" size={22} color={theme.accent} />}
        onPress={() => open("/admin/me/hidden")}
      />
      {isSuper ? (
        <>
          <SectionTitle>{t("admin.me.tools")}</SectionTitle>
          <ListRow
            title={t("admin.pts.title")}
            left={<Ionicons name="people-circle-outline" size={22} color={theme.accent} />}
            onPress={() => open("/admin/pts")}
          />
          <ListRow
            title={t("admin.foods.title")}
            left={<Ionicons name="nutrition-outline" size={22} color={theme.accent} />}
            onPress={() => open("/admin/foods")}
          />
          <ListRow
            title={t("admin.dm.title")}
            left={<Ionicons name="chatbubbles-outline" size={22} color={theme.accent} />}
            onPress={() => open("/admin/dm")}
          />
        </>
      ) : null}
      <Txt size={12} tone="muted">
        {data?.verified ? t("admin.me.verified") : ""}
      </Txt>
    </View>
  );
};
