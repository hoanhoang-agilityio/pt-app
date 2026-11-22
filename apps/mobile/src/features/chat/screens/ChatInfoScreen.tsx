import { Ionicons } from "@expo/vector-icons";
import {
  chatAdminLabel,
  type ChatColorKey,
  chatThreadResponseSchema,
} from "@pt/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import { Sheet } from "@/components/Sheet";
import {
  Button,
  Divider,
  ErrorState,
  Screen,
  Spinner,
  Txt,
} from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { AliasSheet } from "@/features/social/components/AliasSheet";
import { useAliasName } from "@/features/social/hooks";
import { api } from "@/lib/api";
import { chatColorHex, chatColorKeys, isChatColorKey } from "@/lib/chat-colors";
import { qk } from "@/lib/query-keys";
import { useErrorText } from "@/lib/ui-helpers";
import { radius, space, useTheme } from "@/theme";

import { EMPTY_PROFILE, fetchTraineeConversation } from "../api";
import {
  type CoachScope,
  setAccountChatColor,
  setConversationColor,
  setNickname,
} from "../api-manage";
import { usePeerPresence } from "../presence";

// Conversation info of a coach chat (the web's "chat info" page): shared
// nicknames, bubble colour, a private alias, and links to search and the media
// gallery. `cid` is "me" for a trainee, the conversation id for an admin.
export const ChatInfoScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const aliasName = useAliasName();
  const { state } = useAuth();
  const params = useLocalSearchParams<{ cid: string; userId?: string }>();
  const isAdmin =
    state.status === "signedIn" && state.me.actor.kind === "admin";
  const myId = state.status === "signedIn" ? state.me.actor.id : 0;
  const scope: CoachScope = params.cid === "me" ? "me" : Number(params.cid);
  const userId = params.userId ? Number(params.userId) : null;
  const scopeKey = String(scope);
  const [nickTarget, setNickTarget] = useState<{
    key: string;
    real: string;
  } | null>(null);
  const [nickText, setNickText] = useState("");
  const [aliasOpen, setAliasOpen] = useState(false);

  // Admin: the trainee's header carries the profile; trainee: the thread does.
  const info = useQuery({
    queryKey: qk.chatProfile(scopeKey),
    queryFn: async () => {
      if (isAdmin && userId !== null) {
        const c = await fetchTraineeConversation(userId);

        return {
          profile: c.profile,
          peerName: c.userName,
          avatarUrl: c.avatarUrl,
          chatEnabled: c.chatEnabled,
          ptName: "",
          ptId: null as number | null,
        };
      }
      const data = await api.get("/v1/chat/conversations/me/messages", {
        schema: chatThreadResponseSchema,
      });

      return {
        profile: data?.profile ?? EMPTY_PROFILE,
        peerName: data?.latestPt?.name ?? t("chat.coach"),
        avatarUrl: null as string | null,
        chatEnabled: data?.chatEnabled ?? true,
        ptName: data?.latestPt?.name ?? "",
        ptId: data?.latestPt?.id ?? null,
      };
    },
  });
  const presence = usePeerPresence(isAdmin ? userId : null, true);
  const profile = info.data?.profile ?? EMPTY_PROFILE;
  const ownKey = isAdmin ? `admin:${myId}` : "user";
  const otherKey = isAdmin ? "user" : "pt";
  const ownColor = isChatColorKey(profile.colors[ownKey])
    ? profile.colors[ownKey]
    : null;

  const apply = {
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.chatProfile(scopeKey),
      });
    },
    onError: (error: unknown) => Alert.alert(errorText(error)),
  };
  const saveNick = useMutation({
    mutationFn: ({ target, text }: { target: string; text: string }) =>
      setNickname(scope, target, text),
    ...apply,
    onSuccess: () => {
      setNickTarget(null);
      void queryClient.invalidateQueries({
        queryKey: qk.chatProfile(scopeKey),
      });
    },
  });
  const pickColor = useMutation({
    mutationFn: (color: ChatColorKey | null) =>
      isAdmin
        ? setConversationColor(Number(scope), color)
        : setAccountChatColor(color).then(() => undefined),
    ...apply,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.chatProfile(scopeKey),
      });
      // Read the thread again so bubbles take the new colour.
      void queryClient.invalidateQueries({ queryKey: ["chat"] });
    },
  });

  const peerNick = profile.nicknames[otherKey] ?? "";
  const peerReal = info.data?.peerName ?? "";
  const shownPeer = isAdmin
    ? peerNick || peerReal
    : chatAdminLabel(
        profile.nicknames,
        info.data?.ptId ?? null,
        peerReal,
        true,
      );
  const aliasKey = isAdmin ? (userId !== null ? `user:${userId}` : "") : "pt";
  const alias = aliasKey ? aliasName(aliasKey, "") : "";
  const open = (path: string) =>
    router.push(
      `${path}?cid=${scopeKey}${userId !== null ? `&userId=${userId}` : ""}` as string as Href,
    );

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t("chatInfo.title") }} />
      {info.isPending ? (
        <Spinner />
      ) : info.isError ? (
        <ErrorState
          message={errorText(info.error)}
          onRetry={() => void info.refetch()}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        >
          <View style={{ alignItems: "center", gap: space.sm }}>
            <Avatar name={shownPeer} uri={info.data.avatarUrl} size={88} />
            <Txt size={20} weight="700">
              {shownPeer}
            </Txt>
            {presence.text ? (
              <Txt tone={presence.online ? "accent" : "muted"} size={13}>
                {presence.text}
              </Txt>
            ) : null}
          </View>

          <View style={{ gap: space.xs }}>
            <Row
              icon="search-outline"
              label={t("chatInfo.search")}
              onPress={() => open("/chat/search")}
            />
            <Row
              icon="images-outline"
              label={t("chatInfo.gallery")}
              onPress={() => open("/chat/gallery")}
            />
          </View>
          <Divider />

          <Txt weight="600">{t("chatInfo.nicknames")}</Txt>
          <Txt tone="muted" size={13}>
            {t("chatInfo.nicknamesHint")}
          </Txt>
          <Row
            icon="pricetag-outline"
            label={t("chatInfo.nicknameOf", { name: peerReal })}
            value={peerNick}
            disabled={!info.data.chatEnabled && !isAdmin}
            onPress={() => {
              setNickText(peerNick);
              setNickTarget({ key: otherKey, real: peerReal });
            }}
          />
          <Row
            icon="pricetag-outline"
            label={t("chatInfo.nicknameSelf")}
            value={profile.nicknames[ownKey] ?? ""}
            onPress={() => {
              setNickText(profile.nicknames[ownKey] ?? "");
              setNickTarget({ key: ownKey, real: t("common.you") });
            }}
          />
          <Divider />

          <Txt weight="600">
            {isAdmin ? t("chatInfo.colorConversation") : t("chatInfo.colorOwn")}
          </Txt>
          <Txt tone="muted" size={13}>
            {isAdmin
              ? t("chatInfo.colorAdminHint")
              : t("chatInfo.colorUserHint")}
          </Txt>
          <View style={styles.swatches}>
            {chatColorKeys.map((key) => (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={t(`chatInfo.colors.${key}`)}
                accessibilityState={{ selected: ownColor === key }}
                disabled={pickColor.isPending}
                onPress={() => pickColor.mutate(key)}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: chatColorHex(key),
                    borderColor: ownColor === key ? theme.fg : "transparent",
                  },
                ]}
              >
                {ownColor === key ? (
                  <Ionicons name="checkmark" size={20} color="#fff" />
                ) : null}
              </Pressable>
            ))}
          </View>
          {isAdmin && ownColor ? (
            <Button
              label={t("chatInfo.useAccountColor")}
              variant="secondary"
              disabled={pickColor.isPending}
              onPress={() => pickColor.mutate(null)}
            />
          ) : null}
          <Divider />

          {aliasKey ? (
            <Row
              icon="person-outline"
              label={t("alias.privateTitle")}
              value={alias}
              onPress={() => setAliasOpen(true)}
            />
          ) : null}
        </ScrollView>
      )}

      <Sheet
        visible={nickTarget !== null}
        onClose={() => setNickTarget(null)}
        title={t("chatInfo.nicknameSheet", { name: nickTarget?.real ?? "" })}
      >
        <TextInput
          value={nickText}
          onChangeText={setNickText}
          maxLength={30}
          placeholder={nickTarget?.real ?? ""}
          placeholderTextColor={theme.muted}
          style={[styles.input, { color: theme.fg, borderColor: theme.line }]}
        />
        <Button
          label={t("common.save")}
          loading={saveNick.isPending}
          onPress={() =>
            nickTarget &&
            saveNick.mutate({ target: nickTarget.key, text: nickText })
          }
        />
      </Sheet>
      {aliasKey ? (
        <AliasSheet
          visible={aliasOpen}
          onClose={() => setAliasOpen(false)}
          targetKey={aliasKey}
          realName={peerReal}
          current={alias}
        />
      ) : null}
    </Screen>
  );
};

const Row = ({
  icon,
  label,
  value,
  onPress,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  disabled?: boolean;
}) => {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, disabled && { opacity: 0.5 }]}
    >
      <Ionicons name={icon} size={22} color={theme.accent} />
      <View style={{ flex: 1 }}>
        <Txt>{label}</Txt>
        {value ? (
          <Txt tone="muted" size={13}>
            {value}
          </Txt>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.muted} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 48,
  },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    marginBottom: space.md,
    fontSize: 16,
  },
});
