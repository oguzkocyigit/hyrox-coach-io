/**
 * AI egzersiz onerisi onizleme: kabul, duzenle veya yeniden dene.
 */

import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ExerciseSuggestResponse } from "@/api/types";
import { exerciseSummary } from "@/features/program/constants";
import { Button } from "@/ui/Button";
import { color, radius, space, type } from "@/ui/tokens";

type ExerciseSuggestPreviewSheetProps = {
  visible: boolean;
  loading: boolean;
  error: string | null;
  result: ExerciseSuggestResponse | null;
  mode: "append" | "replace";
  onClose: () => void;
  onAccept: () => void;
  onEdit: () => void;
  onRetry: () => void;
};

export function ExerciseSuggestPreviewSheet({
  visible,
  loading,
  error,
  result,
  mode,
  onClose,
  onAccept,
  onEdit,
  onRetry,
}: ExerciseSuggestPreviewSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {mode === "replace" ? "AI Degistirme" : "AI Onerisi"}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
            <Ionicons name="close" size={24} color={color.text.secondary} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={color.accent.primary} />
            <Text style={styles.loadingText}>Hareket seciliyor...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={32} color={color.status.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Button label="Tekrar Dene" onPress={onRetry} />
          </View>
        ) : result ? (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="sparkles" size={16} color={color.accent.primary} />
                <Text style={styles.cardLabel}>ONERILEN HAREKET</Text>
              </View>
              <Text style={styles.exerciseName}>{result.exercise.name}</Text>
              <Text style={styles.exerciseMeta}>{exerciseSummary(result.exercise)}</Text>
              {result.exercise.instructions ? (
                <Text style={styles.instructions}>{result.exercise.instructions}</Text>
              ) : null}
              <Text style={styles.coachNote}>{result.coach_note}</Text>
            </View>

            <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
              <View style={styles.footerButton}>
                <Button label="Vazgec" variant="secondary" size="lg" onPress={onClose} />
              </View>
              <View style={styles.footerButton}>
                <Button label="Duzenle" variant="ghost" size="lg" onPress={onEdit} />
              </View>
              <View style={styles.footerButton}>
                <Button
                  label={mode === "replace" ? "Degistir" : "Ekle"}
                  size="lg"
                  onPress={onAccept}
                />
              </View>
            </View>
            <Pressable onPress={onRetry} hitSlop={8} style={styles.retryLink}>
              <Text style={styles.retryText}>Baska oneri iste</Text>
            </Pressable>
          </>
        ) : null}
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.xl,
  },
  title: {
    ...type.heading1,
    color: color.text.primary,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.lg,
    paddingHorizontal: space.xl,
  },
  loadingText: {
    ...type.body,
    color: color.text.secondary,
  },
  errorText: {
    ...type.body,
    color: color.status.danger,
    textAlign: "center",
  },
  card: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.accent.primary,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  cardLabel: {
    ...type.micro,
    color: color.accent.primary,
  },
  exerciseName: {
    ...type.heading2,
    color: color.text.primary,
  },
  exerciseMeta: {
    ...type.body,
    color: color.text.secondary,
  },
  instructions: {
    ...type.small,
    color: color.text.primary,
    fontStyle: "italic",
  },
  coachNote: {
    ...type.small,
    color: color.text.secondary,
    marginTop: space.xs,
  },
  footer: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.xxl,
  },
  footerButton: {
    flex: 1,
  },
  retryLink: {
    alignItems: "center",
    paddingVertical: space.lg,
  },
  retryText: {
    ...type.small,
    color: color.accent.primary,
  },
});
