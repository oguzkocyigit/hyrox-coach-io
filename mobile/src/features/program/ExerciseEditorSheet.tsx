/**
 * Egzersiz ekleme/duzenleme modali (RoxHype "Edit Exercise" karsiligi).
 * Olcum tipine gore (Tekrar / Sure / Mesafe) ilgili alanlar gosterilir.
 */

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Measurement, TemplateExercise } from "@/api/types";
import { MEASUREMENTS } from "@/features/program/constants";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";
import { color, radius, space, type } from "@/ui/tokens";

type ExerciseEditorSheetProps = {
  visible: boolean;
  /** null: yeni egzersiz; dolu: duzenleme */
  initial: TemplateExercise | null;
  onClose: () => void;
  onSave: (exercise: TemplateExercise) => void;
};

type Draft = {
  name: string;
  measurement: Measurement;
  sets: string;
  reps: string;
  weightKg: string;
  distanceM: string;
  durationSeconds: string;
  restSeconds: string;
  instructions: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  measurement: "reps",
  sets: "1",
  reps: "",
  weightKg: "",
  distanceM: "",
  durationSeconds: "",
  restSeconds: "0",
  instructions: "",
};

function toDraft(e: TemplateExercise): Draft {
  return {
    name: e.name,
    measurement: e.measurement,
    sets: String(e.sets),
    reps: e.reps != null ? String(e.reps) : "",
    weightKg: e.weight_kg != null ? String(e.weight_kg) : "",
    distanceM: e.distance_m != null ? String(e.distance_m) : "",
    durationSeconds: e.duration_seconds != null ? String(e.duration_seconds) : "",
    restSeconds: String(e.rest_seconds),
    instructions: e.instructions ?? "",
  };
}

function parsePositiveInt(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseNonNegativeFloat(value: string): number | null {
  const n = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function ExerciseEditorSheet({
  visible,
  initial,
  onClose,
  onSave,
}: ExerciseEditorSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDraft(initial ? toDraft(initial) : EMPTY_DRAFT);
      setError(null);
    }
  }, [visible, initial]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const handleSave = () => {
    const name = draft.name.trim();
    if (!name) return setError("Egzersiz adi gerekli.");

    const sets = parsePositiveInt(draft.sets);
    if (!sets) return setError("Set sayisi 1 veya daha buyuk olmali.");

    const restSeconds = parseNonNegativeFloat(draft.restSeconds) ?? 0;

    const exercise: TemplateExercise = {
      name,
      exercise_id: initial?.exercise_id ?? null,
      measurement: draft.measurement,
      sets,
      rest_seconds: Math.round(restSeconds),
      reps: null,
      weight_kg: null,
      distance_m: null,
      duration_seconds: null,
      instructions: draft.instructions.trim() || null,
    };

    if (draft.measurement === "reps") {
      const reps = parsePositiveInt(draft.reps);
      if (!reps) return setError("Tekrar sayisi gerekli.");
      exercise.reps = reps;
    } else if (draft.measurement === "time") {
      const duration = parsePositiveInt(draft.durationSeconds);
      if (!duration) return setError("Sure (saniye) gerekli.");
      exercise.duration_seconds = duration;
    } else {
      const distance = parseNonNegativeFloat(draft.distanceM);
      if (!distance) return setError("Mesafe (metre) gerekli.");
      exercise.distance_m = distance;
    }

    if (draft.weightKg.trim()) {
      const weight = parseNonNegativeFloat(draft.weightKg);
      if (weight == null) return setError("Agirlik gecersiz.");
      exercise.weight_kg = weight;
    }

    onSave(exercise);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.container, { paddingTop: insets.top + space.md }]}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {initial ? "Egzersizi Duzenle" : "Egzersiz Ekle"}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
              <Ionicons name="close" size={24} color={color.text.secondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <TextField
              label="Egzersiz Adi"
              value={draft.name}
              onChangeText={(name) => set({ name })}
              placeholder="orn. Sled Push"
              autoCapitalize="words"
            />

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Olcum Tipi</Text>
              <View style={styles.pillRow}>
                {MEASUREMENTS.map((m) => {
                  const active = draft.measurement === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => set({ measurement: m.id })}
                      style={[styles.pill, active && styles.pillActive]}
                    >
                      <Ionicons
                        name={m.icon as keyof typeof Ionicons.glyphMap}
                        size={14}
                        color={active ? color.accent.ink : color.text.secondary}
                      />
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <TextField
                  label="Set"
                  value={draft.sets}
                  onChangeText={(sets) => set({ sets })}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.fieldHalf}>
                {draft.measurement === "reps" ? (
                  <TextField
                    label="Tekrar"
                    value={draft.reps}
                    onChangeText={(reps) => set({ reps })}
                    keyboardType="number-pad"
                    placeholder="10"
                  />
                ) : draft.measurement === "time" ? (
                  <TextField
                    label="Sure (sn)"
                    value={draft.durationSeconds}
                    onChangeText={(durationSeconds) => set({ durationSeconds })}
                    keyboardType="number-pad"
                    placeholder="60"
                  />
                ) : (
                  <TextField
                    label="Mesafe (m)"
                    value={draft.distanceM}
                    onChangeText={(distanceM) => set({ distanceM })}
                    keyboardType="decimal-pad"
                    placeholder="500"
                  />
                )}
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <TextField
                  label="Agirlik (kg) — opsiyonel"
                  value={draft.weightKg}
                  onChangeText={(weightKg) => set({ weightKg })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </View>
              <View style={styles.fieldHalf}>
                <TextField
                  label="Dinlenme (sn)"
                  value={draft.restSeconds}
                  onChangeText={(restSeconds) => set({ restSeconds })}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <TextField
              label="Talimatlar (opsiyonel)"
              value={draft.instructions}
              onChangeText={(instructions) => set({ instructions })}
              placeholder="orn. Kalcadan patlayici, dirsekler hizli."
              multiline
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
            <View style={styles.footerButton}>
              <Button label="Vazgec" variant="secondary" onPress={onClose} />
            </View>
            <View style={styles.footerButton}>
              <Button
                label={initial ? "Guncelle" : "Ekle"}
                onPress={handleSave}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg.base,
  },
  container: {
    flex: 1,
    paddingHorizontal: space.screen,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.lg,
  },
  title: {
    ...type.heading1,
    color: color.text.primary,
  },
  content: {
    gap: space.lg,
    paddingBottom: space.xl,
  },
  section: {
    gap: space.sm,
  },
  sectionLabel: {
    ...type.micro,
    color: color.text.secondary,
  },
  pillRow: {
    flexDirection: "row",
    gap: space.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  pillActive: {
    backgroundColor: color.accent.primary,
    borderColor: color.accent.primary,
  },
  pillText: {
    ...type.small,
    color: color.text.secondary,
  },
  pillTextActive: {
    color: color.accent.ink,
    fontFamily: "Manrope_600SemiBold",
  },
  fieldRow: {
    flexDirection: "row",
    gap: space.md,
  },
  fieldHalf: {
    flex: 1,
  },
  error: {
    ...type.small,
    color: color.status.danger,
  },
  footer: {
    flexDirection: "row",
    gap: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.stroke.subtle,
  },
  footerButton: {
    flex: 1,
  },
});
