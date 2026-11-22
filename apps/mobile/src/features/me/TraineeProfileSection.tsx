import { Ionicons } from "@expo/vector-icons";
import { BIO_MAX_LENGTH, CHAT_COLOR_KEYS, type ChatColorKey } from "@pt/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Field } from "@/components/Field";
import { Button, Divider, Txt } from "@/components/ui";
import { pickAvatarDataUrl } from "@/lib/avatar";
import { CHAT_COLORS } from "@/lib/avatar-plan";
import { PhotoPermissionError, PhotoTooLargeError } from "@/lib/photos";
import { qk } from "@/lib/query-keys";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { useFlash } from "@/lib/use-flash";
import { space, useTheme } from "@/theme";

import { useAuth } from "../auth/auth-context";
import { fetchMyProfile, removeAvatar, setAvatar, setBio, setChatColor } from "./api";

const profileKey = [...qk.me, "profile"] as const;

export const useMyProfile = () =>
  useQuery({ queryKey: profileKey, queryFn: fetchMyProfile });

// The header of the Me tab for a trainee: tap the photo to change or remove it.
export const ProfileAvatar = ({ name }: { name: string }) => {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const profile = useMyProfile();
  const [message, flash] = useFlash();
  const refresh = () => queryClient.invalidateQueries({ queryKey: profileKey });
  const upload = useMutation({
    mutationFn: setAvatar,
    onSuccess: async () => {
      await refresh();
      flash(t("acct.avatar.saved"));
    },
    onError: (error) => Alert.alert(errorText(error)),
  });
  const remove = useMutation({
    mutationFn: removeAvatar,
    onSuccess: async () => {
      await refresh();
      flash(t("acct.avatar.removed"));
    },
    onError: (error) => Alert.alert(errorText(error)),
  });
  const avatarUrl = profile.data?.avatarUrl ?? null;

  const change = async () => {
    try {
      const dataUrl = await pickAvatarDataUrl();

      if (dataUrl) {
        upload.mutate(dataUrl);
      }
    } catch (error) {
      Alert.alert(
        error instanceof PhotoPermissionError
          ? t("acct.avatar.permission")
          : error instanceof PhotoTooLargeError
            ? t("acct.avatar.tooLarge")
            : errorText(error),
      );
    }
  };
  const busy = upload.isPending || remove.isPending;

  return (
    <View style={{ alignItems: "center", gap: space.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("acct.avatar.change")}
        disabled={busy}
        onPress={() => void change()}
        style={{ opacity: busy ? 0.5 : 1 }}
      >
        <Avatar name={name} uri={avatarUrl} size={88} />
      </Pressable>
      <View style={{ flexDirection: "row", gap: space.lg }}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void change()} hitSlop={8}>
          <Txt size={13} tone="accent" weight="600">
            {t("acct.avatar.change")}
          </Txt>
        </Pressable>
        {avatarUrl ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            hitSlop={8}
            onPress={() =>
              confirmAction({
                title: t("acct.avatar.removeConfirm"),
                confirmLabel: t("common.delete"),
                cancelLabel: t("common.cancel"),
                destructive: true,
                onConfirm: () => remove.mutate(),
              })
            }
          >
            <Txt size={13} tone="danger" weight="600">
              {t("acct.avatar.remove")}
            </Txt>
          </Pressable>
        ) : null}
      </View>
      {message ? (
        <Txt size={13} tone="accent" accessibilityLiveRegion="polite">
          {message}
        </Txt>
      ) : null}
    </View>
  );
};

const BioEditor = ({ initial }: { initial: string }) => {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const [bio, setBioText] = useState(initial);
  const [message, flash] = useFlash();
  const save = useMutation({
    mutationFn: () => setBio(bio),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: profileKey });
      flash(t("acct.bio.saved"));
    },
    onError: (error) => Alert.alert(errorText(error)),
  });

  return (
    <View style={{ gap: space.sm }}>
      <Field
        label={t("acct.bio.title")}
        value={bio}
        onChangeText={setBioText}
        placeholder={t("acct.bio.placeholder")}
        maxLength={BIO_MAX_LENGTH}
        multiline
      />
      <Txt size={12} tone="muted" style={{ textAlign: "right" }}>
        {t("acct.bio.counter", { count: bio.length, max: BIO_MAX_LENGTH })}
      </Txt>
      {bio.trim() !== initial ? (
        <Button label={t("acct.bio.save")} variant="secondary" loading={save.isPending} onPress={() => save.mutate()} />
      ) : null}
      {message ? (
        <Txt size={13} tone="accent" accessibilityLiveRegion="polite">
          {message}
        </Txt>
      ) : null}
    </View>
  );
};

const ChatColorPicker = ({ current }: { current: string | null }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const [message, flash] = useFlash();
  const save = useMutation({
    mutationFn: (color: ChatColorKey | null) => setChatColor(color),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: profileKey });
      flash(t("acct.color.saved"));
    },
    onError: (error) => Alert.alert(errorText(error)),
  });

  return (
    <View style={{ gap: space.sm }}>
      <Txt weight="600">{t("acct.color.title")}</Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: current === null }}
          accessibilityLabel={t("acct.color.default")}
          disabled={save.isPending}
          onPress={() => save.mutate(null)}
          style={{
            height: 40,
            borderRadius: 20,
            paddingHorizontal: space.md,
            borderWidth: current === null ? 3 : 1,
            borderColor: current === null ? theme.fg : theme.line,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Txt size={13}>{t("acct.color.default")}</Txt>
        </Pressable>
        {CHAT_COLOR_KEYS.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: current === key }}
            accessibilityLabel={t(`acct.color.${key}`)}
            disabled={save.isPending}
            onPress={() => save.mutate(key)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: CHAT_COLORS[key],
              borderWidth: current === key ? 3 : 0,
              borderColor: theme.fg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {current === key ? <Ionicons name="checkmark" size={20} color="#fff" /> : null}
          </Pressable>
        ))}
      </View>
      {message ? (
        <Txt size={13} tone="accent" accessibilityLiveRegion="polite">
          {message}
        </Txt>
      ) : null}
    </View>
  );
};

const LinkRow = ({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) => {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 }}
    >
      <Ionicons name={icon} size={22} color={theme.accent} />
      <Txt style={{ flex: 1 }}>{label}</Txt>
      <Ionicons name="chevron-forward" size={18} color={theme.muted} />
    </Pressable>
  );
};

// Trainee-only parts of the Me tab: bio, chat colour, week summary, password.
export const TraineeProfileSection = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { state } = useAuth();
  const profile = useMyProfile();

  if (state.status !== "signedIn" || state.me.actor.kind !== "user") {
    return null;
  }
  return (
    <View style={{ gap: space.lg }}>
      {profile.data ? (
        <>
          <BioEditor key={profile.data.bio ?? ""} initial={profile.data.bio ?? ""} />
          <ChatColorPicker current={profile.data.chatColor} />
        </>
      ) : null}
      <Divider />
      <LinkRow
        icon="stats-chart-outline"
        label={t("acct.stats.open")}
        onPress={() => router.push("/summary" as string as Href)}
      />
      <Divider />
      <LinkRow
        icon="key-outline"
        label={t("acct.password.title")}
        onPress={() => router.push("/password" as string as Href)}
      />
      <Txt size={12} tone="muted">
        {t("acct.accentNote")}
      </Txt>
    </View>
  );
};
