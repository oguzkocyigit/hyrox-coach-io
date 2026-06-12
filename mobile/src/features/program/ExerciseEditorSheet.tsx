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

import type { Exercise, Measurement, TemplateExercise } from "@/api/types";
import { MEASUREMENTS } from "@/features/program/constants";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";
import { color, font, radius, space, type } from "@/ui/tokens";

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

type ExerciseEditorSheetProps = {
  visible: boolean;
  /** null: yeni egzersiz; dolu: duzenleme */
  initial: TemplateExercise | null;
  /** Katalogdan secildiyse ad kilitli kalir ve exercise_id atanir */
  catalogExercise?: Pick<Exercise, "exercise_id" | "name"> | null;
  /** Ozel olusturmada arama metninden on doldurma */
  namePrefill?: string;
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
  catalogExercise = null,
  namePrefill = "",
  onClose,
  onSave,
}: ExerciseEditorSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [rpe, setRpe] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fromCatalog = catalogExercise != null && initial == null;

  useEffect(() => {
    if (visible) {
      if (initial) {
        setDraft(toDraft(initial));
        setRpe(initial.rpe ?? null);
      } else if (catalogExercise) {
        setDraft({ ...EMPTY_DRAFT, name: catalogExercise.name });
        setRpe(null);
      } else {
        setDraft({ ...EMPTY_DRAFT, name: namePrefill.trim() });
        setRpe(null);
      }
      setError(null);
    }
  }, [visible, initial, catalogExercise, namePrefill]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const handleSave = () => {
    const name = fromCatalog
      ? catalogExercise!.name
      : draft.name.trim();
    if (!name) return setError("Egzersiz adi gerekli.");

    if (rpe == null) return setError("RPE sec (1-10).");

    const sets = parsePositiveInt(draft.sets);
    if (!sets) return setError("Set sayisi 1 veya daha buyuk olmali.");

    const restSeconds = parseNonNegativeFloat(draft.restSeconds) ?? 0;

    const exercise: TemplateExercise = {
      name,
      exercise_id:
        initial?.exercise_id ?? catalogExercise?.exercise_id ?? null,
      measurement: draft.measurement,
      sets,
      rest_seconds: Math.round(restSeconds),
      rpe,
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
            {fromCatalog ? (
              <View style={styles.catalogRow}>
                <Text style={styles.sectionLabel}>Egzersiz</Text>
                <View style={styles.catalogNameBox}>
                  <Text style={styles.catalogName}>{catalogExercise!.name}</Text>
                  <View style={styles.catalogBadge}>
                    <Ionicons name="library-outline" size={14} color={color.accent.primary} />
                    <Text style={styles.catalogBadgeText}>Katalog</Text>
                  </View>
                </View>
              </View>
            ) : (
              <>
                <TextField
                  label="Egzersiz Adi"
                  value={draft.name}
                  onChangeText={(name) => set({ name })}
                  placeholder="orn. Sled Push"
                  autoCapitalize="words"
                />
                {!initial ? (
                  <Text style={styles.customHint}>
                    Ozel egzersiz — katalogda yoksa CNS hesabi yapilmaz.
                  </Text>
                ) : null}
              </>
            )}

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
                  label="Agirlik (kg)"
                  value={draft.weightKg}
                  onChangeText={(weightKg) => set({ weightKg })}
                  keyboardType="decimal-pad"
                  placeholder="Opsiyonel"
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

            <View style={styles.rpeSection}>
              <View style={styles.rpeHeader}>
                <Text style={styles.sectionLabel}>Hedef RPE</Text>
                <Text
                  style={[
                    styles.rpeValue,
                    rpe == null ? styles.rpeValueEmpty : styles.rpeValueSet,
                  ]}
                >
                  {rpe ?? "—"}
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rpeStrip}
                keyboardShouldPersistTaps="handled"
              >
                {RPE_VALUES.map((value) => {
                  const active = rpe === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setRpe(value)}
                      style={[styles.rpeChip, active && styles.rpeChipActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`RPE ${value}`}
                    >
                      <Text style={[styles.rpeChipText, active && styles.rpeChipTextActive]}>
                        {value}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
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
              <Button label="Vazgec" variant="secondary" size="lg" onPress={onClose} />
            </View>
            <View style={styles.footerButton}>
              <Button
                label={initial ? "Guncelle" : "Ekle"}
                size="lg"
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
    alignItems: "flex-end",
  },
  fieldHalf: {
    flex: 1,
    minWidth: 0,
  },
  catalogRow: {
    gap: space.sm,
  },
  catalogNameBox: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.accent.primary,
    borderRadius: radius.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.sm,
  },
  catalogName: {
    ...type.bodyStrong,
    fontSize: 16,
    color: color.text.primary,
  },
  catalogBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  catalogBadgeText: {
    ...type.small,
    color: color.accent.primary,
  },
  customHint: {
    ...type.small,
    color: color.text.secondary,
    marginTop: -space.sm,
  },
  rpeSection: {
    gap: space.sm,
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    padding: space.md,
  },
  rpeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rpeValue: {
    fontFamily: font.display.semibold,
    fontSize: 22,
    lineHeight: 26,
  },
  rpeValueSet: {
    color: color.accent.primary,
  },
  rpeValueEmpty: {
    color: color.text.disabled,
  },
  rpeStrip: {
    flexDirection: "row",
    gap: space.xs,
    paddingVertical: 2,
  },
  rpeChip: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    backgroundColor: color.bg.elevated,
  },
  rpeChipActive: {
    backgroundColor: color.accent.primary,
    borderColor: color.accent.primary,
  },
  rpeChipText: {
    fontFamily: font.data.medium,
    fontSize: 12,
    color: color.text.secondary,
  },
  rpeChipTextActive: {
    color: color.accent.ink,
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
