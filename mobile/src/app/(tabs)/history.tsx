import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDeleteWorkout, useWorkoutHistory } from "@/api/hooks";
import type { WorkoutHistoryItem, WorkoutSetOut } from "@/api/types";
import { color, font, radius, space, type } from "@/ui/tokens";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
}

const CARDIO_LABELS: Record<string, string> = {
  running: "Kosu",
  rowing: "Kurek",
  ski_erg: "SkiErg",
};

/** Olcum tipine gore set satiri: "120 kg x 6" / "125 kg x 25 m" / "60 sn". */
function formatSetLine(set: WorkoutSetOut): string {
  let value: string;
  if (set.measurement === "distance" && set.distance_m != null) {
    value =
      set.distance_m >= 1000 ? `${set.distance_m / 1000} km` : `${set.distance_m} m`;
  } else if (set.measurement === "time" && set.duration_seconds != null) {
    value = `${set.duration_seconds} sn`;
  } else {
    value = `${set.reps ?? 0}`;
  }
  return set.weight_kg > 0 ? `${set.weight_kg} kg x ${value}` : value;
}

function WorkoutCard({ item }: { item: WorkoutHistoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const deleteWorkout = useDeleteWorkout();

  const totalSets = item.exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const cardioDistance = item.cardio.reduce((sum, c) => sum + c.distance_km, 0);

  const confirmDelete = () => {
    Alert.alert(
      "Idmani sil",
      `"${item.workout_type}" kalici olarak silinecek.`,
      [
        { text: "Vazgec", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => deleteWorkout.mutate(item.workout_log_id),
        },
      ],
    );
  };

  return (
    <Pressable
      onPress={() => setExpanded((prev) => !prev)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardDate}>{formatDate(item.date).toUpperCase()}</Text>
          <Text style={styles.cardTitle}>{item.workout_type}</Text>
        </View>
        {deleteWorkout.isPending ? (
          <ActivityIndicator size="small" color={color.text.secondary} />
        ) : (
          <Pressable onPress={confirmDelete} hitSlop={10} accessibilityLabel="Idmani sil">
            <Ionicons name="trash-outline" size={18} color={color.text.secondary} />
          </Pressable>
        )}
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaItem}>{item.duration_minutes} DK</Text>
        <Text style={styles.metaItem}>RPE {item.user_reported_rpe.toFixed(1)}</Text>
        {item.calories_burned != null ? (
          <Text style={styles.metaItem}>{item.calories_burned} KCAL</Text>
        ) : null}
        {totalSets > 0 ? <Text style={styles.metaItem}>{totalSets} SET</Text> : null}
        {cardioDistance > 0 ? (
          <Text style={styles.metaItem}>{cardioDistance.toFixed(1)} KM</Text>
        ) : null}
      </View>

      {expanded ? (
        <View style={styles.details}>
          {item.journal_notes ? (
            <View style={styles.journalBlock}>
              <Text style={styles.journalLabel}>Gunluk notu</Text>
              <Text style={styles.journalText}>{item.journal_notes}</Text>
            </View>
          ) : null}
          {item.exercises.map((exercise) => (
            <View key={exercise.exercise_id} style={styles.detailBlock}>
              <Text style={styles.detailName}>{exercise.exercise_name}</Text>
              {exercise.sets.map((set, i) => (
                <Text key={i} style={styles.detailLine}>
                  {i + 1}.  {formatSetLine(set)}
                  {set.rpe !== null ? `  @ RPE ${set.rpe}` : ""}
                </Text>
              ))}
            </View>
          ))}
          {item.cardio.map((c, i) => (
            <View key={i} style={styles.detailBlock}>
              <Text style={styles.detailName}>
                {CARDIO_LABELS[c.cardio_type] ?? c.cardio_type}
              </Text>
              <Text style={styles.detailLine}>
                {c.distance_km.toFixed(1)} km · {Math.round(c.duration_minutes)} dk
                {c.avg_hr !== null ? ` · ${c.avg_hr} bpm` : ""}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useWorkoutHistory();

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={color.accent.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.emptyText}>Gecmis yuklenemedi. Tekrar dene.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.workout_log_id}
        contentContainerStyle={{
          paddingTop: insets.top + space.md,
          paddingBottom: insets.bottom + space.xl,
          paddingHorizontal: space.screen,
          gap: space.md,
          flexGrow: 1,
        }}
        ListHeaderComponent={<Text style={styles.title}>Gecmis</Text>}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              Henuz idman yok. Ilk idmanini kaydet — burada listelenecek.
            </Text>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator color={color.accent.primary} style={styles.footerSpinner} />
          ) : null
        }
        renderItem={({ item }) => <WorkoutCard item={item} />}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg.base,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.screen,
  },
  title: {
    ...type.heading1,
    color: color.text.primary,
    marginBottom: space.md,
  },
  emptyText: {
    ...type.body,
    color: color.text.secondary,
    textAlign: "center",
  },
  footerSpinner: {
    marginVertical: space.lg,
  },
  card: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
  },
  cardPressed: {
    backgroundColor: color.bg.elevated,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitleBlock: {
    gap: 2,
    flex: 1,
  },
  cardDate: {
    ...type.micro,
    color: color.text.secondary,
  },
  cardTitle: {
    ...type.bodyStrong,
    color: color.text.primary,
  },
  metaRow: {
    flexDirection: "row",
    gap: space.lg,
  },
  metaItem: {
    fontFamily: font.data.medium,
    fontSize: 11,
    letterSpacing: 0.5,
    color: color.text.secondary,
  },
  details: {
    borderTopWidth: 1,
    borderTopColor: color.stroke.subtle,
    paddingTop: space.md,
    gap: space.md,
  },
  journalBlock: {
    gap: space.xs,
    backgroundColor: color.bg.elevated,
    borderRadius: radius.sm,
    padding: space.md,
  },
  journalLabel: {
    ...type.micro,
    color: color.text.secondary,
  },
  journalText: {
    ...type.small,
    color: color.text.primary,
    lineHeight: 20,
  },
  detailBlock: {
    gap: space.xs,
  },
  detailName: {
    ...type.small,
    color: color.text.primary,
    fontFamily: "Manrope_600SemiBold",
  },
  detailLine: {
    fontFamily: font.data.regular,
    fontSize: 12,
    lineHeight: 18,
    color: color.text.secondary,
  },
});
