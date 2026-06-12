import { router } from "expo-router";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useWeeklyMetrics } from "@/api/hooks";
import { CoachCard } from "@/features/coach/CoachCard";
import { CnsTrendChart } from "@/features/dashboard/CnsTrendChart";
import { TodaysWorkoutCard } from "@/features/program/TodaysWorkoutCard";
import { MuscleLoadBar } from "@/features/dashboard/MuscleLoadBar";
import { WarningBanner } from "@/features/dashboard/WarningBanner";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { color, radius, space, type } from "@/ui/tokens";

function todayCnsScore(dailyScores: Record<string, number>): number {
  const todayIso = new Date().toISOString().slice(0, 10);
  return dailyScores[todayIso] ?? 0;
}

export default function DashboardScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useWeeklyMetrics();

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={color.accent.primary} />
        </View>
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : "Veri yuklenemedi. Tekrar dene."}
          </Text>
        </View>
      </Screen>
    );
  }

  const muscles = Object.entries(data.weekly_muscle_loads).sort((a, b) => b[1] - a[1]);
  const isEmpty = data.total_workouts === 0;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={color.accent.primary}
        />
      }
    >
      <View style={styles.container}>
        <Text style={styles.brand}>HYROX COACH</Text>

        {data.warning_flag ? <WarningBanner muscles={data.overtraining_risk} /> : null}

        <TodaysWorkoutCard />

        <View>
          <Text style={styles.metricLabel}>BUGUNKU CNS YUKU</Text>
          <Text style={styles.cnsScore}>
            {todayCnsScore(data.daily_cns_scores).toFixed(1)}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.metricLabel}>KOSU (7 GUN)</Text>
            <Text style={styles.statValue}>
              {data.total_run_distance_km.toFixed(1)}
              <Text style={styles.statUnit}> km</Text>
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.metricLabel}>IDMAN (7 GUN)</Text>
            <Text style={styles.statValue}>{data.total_workouts}</Text>
          </View>
        </View>

        {isEmpty ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Ilk idmanini kaydet — motoru calistiralim.
            </Text>
            <View style={styles.emptyCta}>
              <Button label="Idman Kaydet" onPress={() => router.push("/log")} />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.musclesCard}>
              <Text style={styles.metricLabel}>CNS TRENDI · SON 7 GUN</Text>
              <CnsTrendChart dailyScores={data.daily_cns_scores} />
            </View>

            <View style={styles.musclesCard}>
              <Text style={styles.metricLabel}>HAFTALIK KAS YUKU · ESIK 22</Text>
              <View style={styles.bars}>
                {muscles.map(([muscle, load]) => (
                  <MuscleLoadBar key={muscle} muscle={muscle} load={load} />
                ))}
              </View>
            </View>

            <CoachCard />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.xxl,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    ...type.body,
    color: color.text.secondary,
    textAlign: "center",
  },
  brand: {
    ...type.micro,
    color: color.accent.primary,
  },
  metricLabel: {
    ...type.micro,
    color: color.text.secondary,
  },
  cnsScore: {
    ...type.displayXl,
    color: color.text.primary,
    marginTop: space.xs,
  },
  statsRow: {
    flexDirection: "row",
    gap: space.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.xs,
  },
  statValue: {
    ...type.displayLg,
    color: color.text.primary,
  },
  statUnit: {
    ...type.small,
    color: color.text.secondary,
  },
  musclesCard: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.lg,
  },
  bars: {
    gap: space.md,
  },
  empty: {
    alignItems: "center",
    paddingVertical: space.huge,
  },
  emptyText: {
    ...type.body,
    color: color.text.secondary,
    textAlign: "center",
  },
  emptyCta: {
    alignSelf: "stretch",
    marginTop: space.lg,
  },
});
