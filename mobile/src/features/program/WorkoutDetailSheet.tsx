/**
 * Idman detay modali ("View Workout"): format/tip rozetleri, tahmini sure,
 * numarali egzersiz listesi ve talimatlar.
 */

import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { WorkoutTemplate } from "@/api/types";
import {
  estimateDurationMinutes,
  exerciseSummary,
  formatMeta,
  formatUsesRounds,
  typeMeta,
} from "@/features/program/constants";
import { color, radius, space, type } from "@/ui/tokens";

type WorkoutDetailSheetProps = {
  visible: boolean;
  template: WorkoutTemplate | null;
  onClose: () => void;
  /** Verilirse sag ustte "Duzenle" gosterilir */
  onEdit?: (template: WorkoutTemplate) => void;
};

export function WorkoutDetailSheet({
  visible,
  template,
  onClose,
  onEdit,
}: WorkoutDetailSheetProps) {
  const insets = useSafeAreaInsets();
  if (!template) return null;

  const meta = typeMeta(template.workout_type);
  const fmt = formatMeta(template.format);
  const estimated = estimateDurationMinutes(template);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
            <Ionicons name="close" size={24} color={color.text.secondary} />
          </Pressable>
          {onEdit ? (
            <Pressable
              onPress={() => onEdit(template)}
              hitSlop={12}
              style={styles.editLink}
              accessibilityLabel="Duzenle"
            >
              <Ionicons name="create-outline" size={18} color={color.accent.primary} />
              <Text style={styles.editText}>Duzenle</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
          <View style={styles.badges}>
            <View style={styles.badge}>
              <View style={[styles.dot, { backgroundColor: meta.dot }]} />
              <Text style={styles.badgeText}>{meta.label}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{fmt.label}</Text>
            </View>
            {formatUsesRounds(template.format) && template.rounds > 1 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{template.rounds} tur</Text>
              </View>
            ) : null}
            {template.time_cap_minutes ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{template.time_cap_minutes} dk limit</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.title}>{template.name}</Text>

          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={15} color={color.text.secondary} />
            <Text style={styles.metaText}>Tahmini {estimated} dk</Text>
            <Ionicons name="barbell-outline" size={15} color={color.text.secondary} />
            <Text style={styles.metaText}>{template.exercises.length} egzersiz</Text>
          </View>

          <Text style={styles.formatHint}>{fmt.description}</Text>

          <Text style={styles.sectionLabel}>Egzersizler</Text>
          {template.exercises.map((exercise, index) => (
            <View key={`${exercise.name}-${index}`} style={styles.exerciseRow}>
              <View style={styles.orderBadge}>
                <Text style={styles.orderText}>{index + 1}</Text>
              </View>
              <View style={styles.exerciseTexts}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.exerciseMeta}>{exerciseSummary(exercise)}</Text>
                {exercise.instructions ? (
                  <Text style={styles.instructions}>{exercise.instructions}</Text>
                ) : null}
              </View>
            </View>
          ))}

          {template.notes ? (
            <>
              <Text style={styles.sectionLabel}>Notlar</Text>
              <Text style={styles.notes}>{template.notes}</Text>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg.base,
    paddingHorizontal: space.screen,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.lg,
  },
  editLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  editText: {
    ...type.bodyStrong,
    color: color.accent.primary,
  },
  content: {
    gap: space.md,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs + 2,
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  badgeText: {
    ...type.micro,
    color: color.text.secondary,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    ...type.displayLg,
    color: color.text.primary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  metaText: {
    ...type.small,
    color: color.text.secondary,
    marginRight: space.md,
  },
  formatHint: {
    ...type.small,
    color: color.text.secondary,
    fontStyle: "italic",
  },
  sectionLabel: {
    ...type.micro,
    color: color.accent.primary,
    marginTop: space.md,
  },
  exerciseRow: {
    flexDirection: "row",
    gap: space.md,
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    padding: space.md,
  },
  orderBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: color.bg.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  orderText: {
    ...type.micro,
    color: color.accent.primary,
  },
  exerciseTexts: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    ...type.bodyStrong,
    color: color.text.primary,
  },
  exerciseMeta: {
    ...type.small,
    color: color.text.secondary,
  },
  instructions: {
    ...type.small,
    color: color.text.secondary,
    fontStyle: "italic",
    marginTop: space.xs,
  },
  notes: {
    ...type.body,
    color: color.text.secondary,
  },
});
