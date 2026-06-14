import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { WorkoutCreateResponse } from "@/api/types";
import { MuscleLoadBar } from "@/features/dashboard/MuscleLoadBar";
import { WarningBanner } from "@/features/dashboard/WarningBanner";
import { Button } from "@/ui/Button";
import { color, radius, space, type } from "@/ui/tokens";

type ResultSheetProps = {
  result: WorkoutCreateResponse | null;
  onClose: () => void;
};

/** Idman kaydi sonrasi anlik analiz: skor -> uyari -> kas barlari. */
export function ResultSheet({ result, onClose }: ResultSheetProps) {
  const insets = useSafeAreaInsets();

  if (!result) return null;

  const sortedLoads = [...result.weekly_muscle_loads].sort(
    (a, b) => b.weekly_load - a.weekly_load,
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouchable} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.content}>
            <View>
              <Text style={styles.label}>IDMAN KAYDEDILDI · GUNLUK CNS SKORU</Text>
              <Text style={styles.score}>{result.daily_cns_score.toFixed(2)}</Text>
              <Text style={styles.meta}>
                {result.summary.duration_minutes} dk
                {result.summary.calories_burned != null
                  ? ` · ${result.summary.calories_burned} kcal`
                  : ""}
              </Text>
            </View>

            {result.warning_flag ? (
              <WarningBanner muscles={result.overtraining_risk} />
            ) : null}

            {sortedLoads.length > 0 ? (
              <View style={styles.barsSection}>
                <Text style={styles.label}>HAFTALIK KAS YUKU · ESIK 22</Text>
                <View style={styles.bars}>
                  {sortedLoads.map((m) => (
                    <MuscleLoadBar key={m.muscle} muscle={m.muscle} load={m.weekly_load} />
                  ))}
                </View>
              </View>
            ) : null}

            <Button label="Tamam" variant="ghost" onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  backdropTouchable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: color.bg.elevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.screen,
    paddingTop: space.md,
    maxHeight: "85%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: color.stroke.strong,
    marginBottom: space.lg,
  },
  content: {
    gap: space.xxl,
  },
  label: {
    ...type.micro,
    color: color.text.secondary,
  },
  score: {
    ...type.displayLg,
    color: color.text.primary,
    marginTop: space.xs,
  },
  meta: {
    ...type.small,
    color: color.text.secondary,
    marginTop: space.xs,
  },
  barsSection: {
    gap: space.lg,
  },
  bars: {
    gap: space.md,
  },
});
