import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Screen, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { currentWeekStart, shiftWeek, shortDate, weekRange } from "@/lib/admin-utils";
import { formatAge } from "@/lib/time";
import { space, useTheme } from "@/theme";

import { fetchActivity, fetchDashboard } from "../api";
import { Card, Chip, ChipRow, ListRow, Loaded, Pill, ProgressBar, SectionTitle } from "../components/kit";
import { ak } from "../keys";
import { useIsSuperAdmin, usePts } from "../use-admin";

const STATUS_TONE = {
  "no-plan": "muted",
  "not-started": "muted",
  "in-progress": "accent",
  done: "success",
} as const;

const Stat = ({ value, label }: { value: string | number; label: string }) => (
  <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
    <Txt size={22} weight="700">
      {value}
    </Txt>
    <Txt size={12} tone="muted" style={{ textAlign: "center" }}>
      {label}
    </Txt>
  </View>
);

export const DashboardScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const isSuper = useIsSuperAdmin();
  const pts = usePts();
  const [week, setWeek] = useState(currentWeekStart);
  const [pt, setPt] = useState<"all" | "none" | number>("all");
  const dashboard = useQuery({
    queryKey: ak.dashboard(week, String(pt)),
    queryFn: () => fetchDashboard(week, pt),
  });
  const activity = useQuery({ queryKey: ak.activity, queryFn: () => fetchActivity() });
  const refreshing = dashboard.isRefetching || activity.isRefetching;
  const refresh = () => {
    void dashboard.refetch();
    void activity.refetch();
  };
  const isCurrent = week === currentWeekStart();
  const now = new Date();
  const labels = {
    now: t("time.now"),
    minutes: t("time.minutes"),
    hours: t("time.hours"),
    days: t("time.days"),
  };
  const open = (path: string) => router.push(path as string as Href);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Txt size={24} weight="700">
          {t("admin.dashboard.title")}
        </Txt>

        <View style={styles.weekBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("admin.week.prev")}
            hitSlop={10}
            onPress={() => setWeek(shiftWeek(week, -1))}
          >
            <Ionicons name="chevron-back" size={22} color={theme.fg} />
          </Pressable>
          <Pressable onPress={() => setWeek(currentWeekStart())} accessibilityRole="button">
            <Txt weight="600">
              {shortDate(week)} – {shortDate(weekRange(week).to)}
            </Txt>
            <Txt size={12} tone="muted" style={{ textAlign: "center" }}>
              {isCurrent ? t("admin.week.thisWeek") : t("admin.week.backToCurrent")}
            </Txt>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("admin.week.next")}
            hitSlop={10}
            onPress={() => setWeek(shiftWeek(week, 1))}
          >
            <Ionicons name="chevron-forward" size={22} color={theme.fg} />
          </Pressable>
        </View>

        {isSuper ? (
          <ChipRow>
            <Chip label={t("admin.dashboard.allPts")} selected={pt === "all"} onPress={() => setPt("all")} />
            <Chip label={t("admin.dashboard.noPt")} selected={pt === "none"} onPress={() => setPt("none")} />
            {(pts.data?.accounts ?? []).map((account) => (
              <Chip
                key={account.id}
                label={account.username}
                selected={pt === account.id}
                onPress={() => setPt(account.id)}
              />
            ))}
          </ChipRow>
        ) : null}

        <Loaded query={dashboard}>
          {(data) => (
            <>
              <Card gap={space.md}>
                <View style={{ flexDirection: "row" }}>
                  <Stat value={data.summary.memberCount} label={t("admin.dashboard.members")} />
                  <Stat value={data.summary.plannedCount} label={t("admin.dashboard.planned")} />
                  <Stat value={data.summary.activeCount} label={t("admin.dashboard.active")} />
                  <Stat value={`${data.summary.percent}%`} label={t("admin.dashboard.done")} />
                </View>
                <ProgressBar percent={data.summary.percent} />
                <Txt size={12} tone="muted">
                  {t("admin.dashboard.exercises", {
                    done: data.summary.completed,
                    total: data.summary.assigned,
                  })}
                </Txt>
              </Card>

              <SectionTitle>{t("admin.dashboard.membersTitle")}</SectionTitle>
              {data.members.length === 0 ? (
                <Txt tone="muted">{t("admin.members.empty")}</Txt>
              ) : (
                data.members.map((member) => (
                  <ListRow
                    key={member.id}
                    title={member.displayName}
                    subtitle={
                      member.status === "no-plan"
                        ? t("admin.status.no-plan")
                        : t("admin.dashboard.memberLine", {
                            done: member.completed,
                            total: member.assigned,
                            percent: member.percent,
                          })
                    }
                    left={<Avatar name={member.displayName} uri={member.avatarUrl} size={44} />}
                    right={
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <Pill label={t(`admin.status.${member.status}`)} tone={STATUS_TONE[member.status]} />
                        {member.restrictionLevel ? (
                          <Pill label={t(`admin.restriction.level.${member.restrictionLevel}`)} tone="danger" />
                        ) : null}
                      </View>
                    }
                    onPress={() => open(`/admin/trainee/${member.id}`)}
                  />
                ))
              )}
            </>
          )}
        </Loaded>

        <SectionTitle>{t("admin.dashboard.activityTitle")}</SectionTitle>
        <Loaded query={activity}>
          {(data) =>
            data.items.length === 0 ? (
              <Txt tone="muted">{t("admin.dashboard.activityEmpty")}</Txt>
            ) : (
              data.items.map((item) => (
                <ListRow
                  key={`${item.kind}-${item.id}`}
                  title={item.displayName}
                  subtitle={
                    item.kind === "personalBest"
                      ? t("admin.dashboard.personalBest", {
                          exercise: item.exerciseTitle,
                          kg: item.best.weightKg,
                          reps: item.best.reps,
                        })
                      : t("admin.dashboard.completed", { exercise: item.exerciseTitle })
                  }
                  right={
                    <Txt size={12} tone="muted">
                      {formatAge(item.occurredAt, now, currentLocale(), labels)}
                    </Txt>
                  }
                  onPress={() => open(`/admin/trainee/${item.userId}`)}
                />
              ))
            )
          }
        </Loaded>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  weekBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
