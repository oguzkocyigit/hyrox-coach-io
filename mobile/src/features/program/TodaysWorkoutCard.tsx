/**
 * Dashboard "Bugunun Idmani" karti: haftalik plandan bugune atanmis
 * idmanlari gosterir; goruntuleme ve tamamlama kisa yollari sunar.
 * Bugune atama yoksa hicbir sey render etmez.
 */

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSetEntryCompletion, useWeekPlan } from "@/api/hooks";
import type { PlanEntry } from "@/api/types";
import {
  estimateDurationMinutes,
  exerciseSummary,
  typeMeta,
} from "@/features/program/constants";
import { WorkoutDetailSheet } from "@/features/program/WorkoutDetailSheet";
import { color, radius, space, type } from "@/ui/tokens";

const PREVIEW_COUNT = 5;

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toIsoDate(d);
}

export function TodaysWorkoutCard() {
  const { data: plan } = useWeekPlan(mondayIso());
  const setCompletion = useSetEntryCompletion();
  const [detailEntry, setDetailEntry] = useState<PlanEntry | null>(null);

  const todayIso = toIsoDate(new Date());
  const todaysEntries = (plan?.entries ?? []).filter(
    (e) => e.scheduled_date === todayIso,
  );
  if (todaysEntries.length === 0) return null;

  // Tamamlanmamis ilk idman one cikar; hepsi bittiyse sonuncusu gosterilir
  const entry =
    todaysEntries.find((e) => !e.completed_at) ??
    todaysEntries[todaysEntries.length - 1];
  const meta = typeMeta(entry.template.workout_type);
  const completed = entry.completed_at != null;
  const preview = entry.template.exercises.slice(0, PREVIEW_COUNT);
  const remaining = entry.template.exercises.length - preview.length;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>BUGUNUN IDMANI</Text>
        <View style={[styles.typeBadge, { borderColor: meta.dot }]}>
          <View style={[styles.dot, { backgroundColor: meta.dot }]} />
          <Text style={styles.typeBadgeText}>{meta.label}</Text>
        </View>
      </View>

      <Text style={styles.name}>{entry.template.name}</Text>

      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={13} color={color.text.secondary} />
        <Text style={styles.metaText}>
          ~{estimateDurationMinutes(entry.template)} dk
        </Text>
        <Ionicons name="barbell-outline" size={13} color={color.text.secondary} />
        <Text style={styles.metaText}>
          {entry.template.exercises.length} egzersiz
        </Text>
        {todaysEntries.length > 1 ? (
          <Text style={styles.metaText}>
            · {todaysEntries.filter((e) => e.completed_at).length}/
            {todaysEntries.length} tamam
          </Text>
        ) : null}
      </View>

      <View style={styles.previewList}>
        {preview.map((exercise, index) => (
          <View key={`${exercise.name}-${index}`} style={styles.previewRow}>
            <Text style={styles.previewIndex}>{index + 1}.</Text>
            <View style={styles.previewTexts}>
              <Text style={styles.previewName}>{exercise.name}</Text>
              <Text style={styles.previewMeta}>{exerciseSummary(exercise)}</Text>
            </View>
          </View>
        ))}
        {remaining > 0 ? (
          <Text style={styles.previewMore}>+{remaining} egzersiz daha</Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => setDetailEntry(entry)}
          style={({ pressed }) => [styles.viewButton, pressed && styles.viewButtonPressed]}
        >
          <Text style={styles.viewButtonText}>Goruntule</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            void setCompletion.mutateAsync({
              entryId: entry.entry_id,
              completed: !completed,
            })
          }
          style={[styles.checkButton, completed && styles.checkButtonDone]}
          accessibilityLabel={completed ? "Tamamlandi isaretini kaldir" : "Tamamlandi isaretle"}
        >
          <Ionicons
            name="checkmark"
            size={20}
            color={completed ? color.accent.ink : color.text.secondary}
          />
        </Pressable>
      </View>

      <Pressable onPress={() => router.push("/program")} hitSlop={8}>
        <Text style={styles.planLink}>Haftalik plani gor →</Text>
      </Pressable>

      <WorkoutDetailSheet
        visible={detailEntry != null}
        template={detailEntry?.template ?? null}
        onClose={() => setDetailEntry(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    ...type.micro,
    color: color.accent.primary,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs + 2,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: 3,
  },
  typeBadgeText: {
    ...type.micro,
    color: color.text.primary,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  name: {
    ...type.heading1,
    color: color.text.primary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  metaText: {
    ...type.small,
    color: color.text.secondary,
    marginRight: space.sm,
  },
  previewList: {
    gap: space.sm,
  },
  previewRow: {
    flexDirection: "row",
    gap: space.sm,
  },
  previewIndex: {
    ...type.bodyStrong,
    color: color.accent.primary,
    width: 20,
  },
  previewTexts: {
    flex: 1,
    gap: 1,
  },
  previewName: {
    ...type.bodyStrong,
    color: color.text.primary,
  },
  previewMeta: {
    ...type.small,
    color: color.text.secondary,
  },
  previewMore: {
    ...type.small,
    color: color.text.secondary,
    marginLeft: 28,
  },
  actions: {
    flexDirection: "row",
    gap: space.sm,
  },
  viewButton: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: color.accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  viewButtonPressed: {
    backgroundColor: color.accent.pressed,
  },
  viewButtonText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 15,
    color: color.accent.ink,
  },
  checkButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkButtonDone: {
    backgroundColor: color.status.safe,
    borderColor: color.status.safe,
  },
  planLink: {
    ...type.small,
    color: color.text.secondary,
    textAlign: "center",
  },
});
