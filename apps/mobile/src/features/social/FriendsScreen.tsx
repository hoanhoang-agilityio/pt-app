import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { Button, EmptyState, ErrorState, Screen, Spinner, Txt } from "@/components/ui";
import { useSocialMe } from "@/features/feed/hooks";
import { qk } from "@/lib/query-keys";
import { parseSearchEmail } from "@/lib/social-rules";
import { useErrorText } from "@/lib/ui-helpers";
import { radius, space, useTheme } from "@/theme";

import { searchPeople } from "./api";
import { PersonRow, RelationshipButtons } from "./components/PersonRow";
import { TermsGate } from "./components/TermsGate";
import { useFriendRequests, useFriends, useIsTrainee, useRelationshipActions } from "./hooks";

type Tab = "friends" | "requests" | "search";

const FriendsTab = () => {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const friends = useFriends();

  if (friends.isPending) {
    return <Spinner />;
  }
  if (friends.isError) {
    return <ErrorState message={errorText(friends.error)} onRetry={() => void friends.refetch()} />;
  }
  if (friends.data.items.length === 0) {
    return <EmptyState icon="people-outline" title={t("friends.empty")} hint={t("friends.emptyHint")} />;
  }
  return (
    <>
      {friends.data.items.map((person) => (
        <PersonRow key={person.id} {...person}>
          <RelationshipButtons userId={person.id} name={person.name} relationship="friends" compact />
        </PersonRow>
      ))}
    </>
  );
};

const RequestsTab = () => {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const requests = useFriendRequests();

  if (requests.isPending) {
    return <Spinner />;
  }
  if (requests.isError) {
    return <ErrorState message={errorText(requests.error)} onRetry={() => void requests.refetch()} />;
  }
  const { received, sent } = requests.data;

  if (received.length + sent.length === 0) {
    return <EmptyState icon="mail-outline" title={t("friends.requestsEmpty")} />;
  }
  return (
    <>
      {received.length > 0 ? (
        <Txt tone="muted" size={13} weight="600" style={styles.section}>
          {t("friends.received")}
        </Txt>
      ) : null}
      {received.map((person) => (
        <PersonRow key={`r${person.id}`} {...person}>
          <RelationshipButtons userId={person.id} name={person.name} relationship="received" compact />
        </PersonRow>
      ))}
      {sent.length > 0 ? (
        <Txt tone="muted" size={13} weight="600" style={styles.section}>
          {t("friends.sent")}
        </Txt>
      ) : null}
      {sent.map((person) => (
        <PersonRow key={`s${person.id}`} {...person}>
          <RelationshipButtons userId={person.id} name={person.name} relationship="sent" compact />
        </PersonRow>
      ))}
    </>
  );
};

const SearchTab = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const actions = useRelationshipActions();
  const [text, setText] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const result = useQuery({
    queryKey: qk.people(email ?? ""),
    queryFn: () => searchPeople(email ?? ""),
    enabled: email !== null,
  });

  const submit = () => {
    const parsed = parseSearchEmail(text);

    setInvalid(parsed === null);
    setEmail(parsed);
  };
  const person = result.data?.result ?? null;

  return (
    <View style={{ padding: space.lg, gap: space.md }}>
      <Txt tone="muted" size={13}>
        {t("friends.searchHint")}
      </Txt>
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        returnKeyType="search"
        placeholder={t("friends.searchPlaceholder")}
        placeholderTextColor={theme.muted}
        style={[styles.input, { color: theme.fg, borderColor: theme.line }]}
      />
      {invalid ? <Txt tone="danger">{t("friends.emailInvalid")}</Txt> : null}
      <Button label={t("friends.search")} loading={result.isFetching} onPress={submit} />
      {result.isError ? <Txt tone="danger">{errorText(result.error)}</Txt> : null}
      {email !== null && result.isSuccess && !result.isFetching ? (
        person ? (
          <PersonRow id={person.id} name={person.name} avatarUrl={person.avatarUrl}>
            {person.relationship === "friends" ||
            person.relationship === "sent" ||
            person.relationship === "received" ||
            person.relationship === "none" ? (
              <RelationshipButtons
                userId={person.id}
                name={person.name}
                relationship={person.relationship}
                compact
              />
            ) : null}
          </PersonRow>
        ) : (
          <Txt tone="muted" style={{ textAlign: "center" }}>
            {t("friends.notFound")}
          </Txt>
        )
      ) : null}
      {actions.add.isSuccess && actions.add.data?.accepted ? (
        <Txt tone="accent">{t("friends.nowFriends")}</Txt>
      ) : null}
    </View>
  );
};

// Friends, requests and the exact-email people search (trainees only, after
// the social terms).
export const FriendsScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isTrainee = useIsTrainee();
  const social = useSocialMe();
  const requests = useFriendRequests();
  const friends = useFriends();
  const [tab, setTab] = useState<Tab>("friends");
  const termsOk = social.data?.termsAccepted === true;
  const pendingCount = requests.data?.received.length ?? 0;

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t("friends.title") }} />
      {!isTrainee ? (
        <EmptyState icon="people-outline" title={t("friends.traineesOnly")} />
      ) : social.isPending ? (
        <Spinner />
      ) : !termsOk ? (
        <TermsGate />
      ) : (
        <>
          <View style={[styles.tabs, { backgroundColor: theme.line }]}>
            {(["friends", "requests", "search"] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === value }}
                onPress={() => setTab(value)}
                style={[styles.tab, tab === value && { backgroundColor: theme.surface }]}
              >
                <Txt size={14} weight="600" tone={tab === value ? "default" : "muted"}>
                  {t(`friends.tabs.${value}`)}
                  {value === "requests" && pendingCount > 0 ? ` (${pendingCount})` : ""}
                </Txt>
              </Pressable>
            ))}
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1 }}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={() => {
                  void requests.refetch().catch(() => Alert.alert(t("common.errorGeneric")));
                  void friends.refetch();
                }}
              />
            }
          >
            {tab === "friends" ? <FriendsTab /> : tab === "requests" ? <RequestsTab /> : <SearchTab />}
          </ScrollView>
        </>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", borderRadius: 10, padding: 3, margin: space.lg },
  tab: { flex: 1, minHeight: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  section: { paddingHorizontal: space.lg, paddingTop: space.md },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    fontSize: 16,
  },
});
