import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useLogWorkout } from "@/api/hooks";
import type {
  CardioType,
  Exercise,
  SetMeasurement,
  WorkoutCreateResponse,
} from "@/api/types";
import {
  buildPayload,
  defaultMeasurement,
  emptyCardio,
  emptySet,
  type CardioDraft,
  type ExerciseDraft,
} from "@/features/workout-log/draft";
import { ExercisePicker } from "@/features/workout-log/ExercisePicker";
import { ResultSheet } from "@/features/workout-log/ResultSheet";
import { WhenField } from "@/features/workout-log/WhenField";
import { resolveWhen, todayWhen, type WhenState } from "@/features/workout-log/when";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { TextField } from "@/ui/TextField";
import { color, font, radius, space, type } from "@/ui/tokens";

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const CARDIO_TYPES: { id: CardioType; label: string }[] = [
  { id: "running", label: "Kosu" },
  { id: "rowing", label: "Kurek" },
  { id: "ski_erg", label: "SkiErg" },
];

const MEASUREMENTS: { id: SetMeasurement; label: string; column: string; unitHint: string }[] = [
  { id: "reps", label: "Tekrar", column: "TEKRAR", unitHint: "10" },
  { id: "distance", label: "Mesafe", column: "MESAFE (M)", unitHint: "200" },
  { id: "time", label: "Sure", column: "SURE (SN)", unitHint: "60" },
];

function measurementMeta(id: SetMeasurement) {
  return MEASUREMENTS.find((m) => m.id === id) ?? MEASUREMENTS[0];
}

export default function LogWorkoutScreen() {
  const [workoutType, setWorkoutType] = useState("");
  const [duration, setDuration] = useState("");
  const [calories, setCalories] = useState("");
  const [when, setWhen] = useState<WhenState>(todayWhen);
  const [rpe, setRpe] = useState<number | null>(null);
  const [exercises, setExercises] = useState<ExerciseDraft[]>([]);
  const [cardio, setCardio] = useState<CardioDraft | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<WorkoutCreateResponse | null>(null);

  const logWorkout = useLogWorkout();

  const addExercise = (exercise: Exercise) => {
    setExercises((prev) => [
      ...prev,
      { exercise, measurement: defaultMeasurement(exercise), sets: [emptySet()] },
    ]);
  };

  const setMeasurement = (exerciseIndex: number, measurement: SetMeasurement) => {
    setExercises((prev) =>
      prev.map((draft, i) =>
        i !== exerciseIndex
          ? draft
          : {
              ...draft,
              measurement,
              // Olcum degisince deger kolonu sifirlanir (birim degisti)
              sets: draft.sets.map((s) => ({ ...s, value: "" })),
            },
      ),
    );
  };

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: "weight" | "value" | "rpe",
    value: string,
  ) => {
    setExercises((prev) =>
      prev.map((draft, i) =>
        i !== exerciseIndex
          ? draft
          : {
              ...draft,
              sets: draft.sets.map((s, j) =>
                j !== setIndex ? s : { ...s, [field]: value },
              ),
            },
      ),
    );
  };

  const resetForm = () => {
    setWorkoutType("");
    setDuration("");
    setCalories("");
    setWhen(todayWhen());
    setRpe(null);
    setExercises([]);
    setCardio(null);
    setFormError(null);
  };

  const onSubmit = () => {
    setFormError(null);
    const resolved = resolveWhen(when);
    const validation = buildPayload({
      workoutType,
      rpe,
      duration,
      calories,
      dateISO: resolved.dateISO,
      derivedDurationMinutes: resolved.durationMinutes,
      exercises,
      cardio,
    });
    if (!validation.ok) {
      setFormError(validation.message);
      return;
    }
    logWorkout.mutate(validation.payload, {
      onSuccess: (response) => setResult(response),
      onError: (error) =>
        setFormError(error instanceof Error ? error.message : "Kayit basarisiz."),
    });
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Idman Kaydet</Text>

        <TextField
          label="Idman tipi"
          value={workoutType}
          onChangeText={setWorkoutType}
          placeholder="Full Body, Zone 2 Run, Hyrox Sim..."
        />

        <WhenField value={when} onChange={setWhen} />

        {when.startMin != null && when.endMin != null && when.endMin > when.startMin ? null : (
          <TextField
            label="Sure (dakika)"
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            placeholder="60"
          />
        )}

        <TextField
          label="Kalori (kcal) — opsiyonel"
          value={calories}
          onChangeText={setCalories}
          keyboardType="number-pad"
          placeholder="450"
        />

        {/* RPE secimi */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>IDMAN GENELI RPE</Text>
          <View style={styles.rpeRow}>
            {RPE_VALUES.map((value) => {
              const active = rpe === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setRpe(value)}
                  style={[styles.rpePill, active && styles.rpePillActive]}
                  accessibilityLabel={`RPE ${value}`}
                >
                  <Text style={[styles.rpeText, active && styles.rpeTextActive]}>
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Kuvvet blogu */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>KUVVET</Text>
          {exercises.map((draft, exerciseIndex) => (
            <View key={draft.exercise.exercise_id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseName}>{draft.exercise.name}</Text>
                <Pressable
                  onPress={() =>
                    setExercises((prev) => prev.filter((_, i) => i !== exerciseIndex))
                  }
                  hitSlop={8}
                  accessibilityLabel={`${draft.exercise.name} egzersizini kaldir`}
                >
                  <Ionicons name="trash-outline" size={18} color={color.text.secondary} />
                </Pressable>
              </View>

              {/* Olcum tipi secimi: Tekrar / Mesafe / Sure */}
              <View style={styles.measurementRow}>
                {MEASUREMENTS.map((m) => {
                  const active = draft.measurement === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setMeasurement(exerciseIndex, m.id)}
                      style={[
                        styles.measurementPill,
                        active && styles.measurementPillActive,
                      ]}
                      accessibilityLabel={`Olcum: ${m.label}`}
                    >
                      <Text
                        style={[
                          styles.measurementText,
                          active && styles.measurementTextActive,
                        ]}
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.setHeaderRow}>
                <Text style={styles.setHeaderCell}>KG</Text>
                <Text style={styles.setHeaderCell}>
                  {measurementMeta(draft.measurement).column}
                </Text>
                <Text style={styles.setHeaderCell}>RPE</Text>
                <View style={styles.setRemoveSpace} />
              </View>

              {draft.sets.map((set, setIndex) => (
                <View key={setIndex} style={styles.setRow}>
                  <TextInput
                    style={styles.setInput}
                    value={set.weight}
                    onChangeText={(v) => updateSet(exerciseIndex, setIndex, "weight", v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={color.text.disabled}
                  />
                  <TextInput
                    style={styles.setInput}
                    value={set.value}
                    onChangeText={(v) => updateSet(exerciseIndex, setIndex, "value", v)}
                    keyboardType={
                      draft.measurement === "distance" ? "decimal-pad" : "number-pad"
                    }
                    placeholder={measurementMeta(draft.measurement).unitHint}
                    placeholderTextColor={color.text.disabled}
                  />
                  <TextInput
                    style={styles.setInput}
                    value={set.rpe}
                    onChangeText={(v) => updateSet(exerciseIndex, setIndex, "rpe", v)}
                    keyboardType="decimal-pad"
                    placeholder="-"
                    placeholderTextColor={color.text.disabled}
                  />
                  <Pressable
                    onPress={() =>
                      setExercises((prev) =>
                        prev.map((d, i) =>
                          i !== exerciseIndex
                            ? d
                            : { ...d, sets: d.sets.filter((_, j) => j !== setIndex) },
                        ),
                      )
                    }
                    hitSlop={8}
                    style={styles.setRemoveSpace}
                    accessibilityLabel={`${setIndex + 1}. seti kaldir`}
                  >
                    <Ionicons name="close" size={16} color={color.text.disabled} />
                  </Pressable>
                </View>
              ))}

              <Pressable
                onPress={() =>
                  setExercises((prev) =>
                    prev.map((d, i) =>
                      i !== exerciseIndex ? d : { ...d, sets: [...d.sets, emptySet()] },
                    ),
                  )
                }
                style={styles.addSetButton}
              >
                <Ionicons name="add" size={16} color={color.accent.primary} />
                <Text style={styles.addSetText}>Set Ekle</Text>
              </Pressable>
            </View>
          ))}

          <Button
            label="Egzersiz Ekle"
            variant="secondary"
            onPress={() => setPickerVisible(true)}
          />
        </View>

        {/* Kardiyo blogu */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>KARDIYO</Text>
          {cardio === null ? (
            <Button
              label="Kardiyo Ekle"
              variant="secondary"
              onPress={() => setCardio(emptyCardio())}
            />
          ) : (
            <View style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View style={styles.cardioTypes}>
                  {CARDIO_TYPES.map((c) => {
                    const active = cardio.cardio_type === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setCardio({ ...cardio, cardio_type: c.id })}
                        style={[styles.rpePill, active && styles.rpePillActive]}
                      >
                        <Text style={[styles.rpeText, active && styles.rpeTextActive]}>
                          {c.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  onPress={() => setCardio(null)}
                  hitSlop={8}
                  accessibilityLabel="Kardiyo blogunu kaldir"
                >
                  <Ionicons name="trash-outline" size={18} color={color.text.secondary} />
                </Pressable>
              </View>

              <TextField
                label="Mesafe (km)"
                value={cardio.distance}
                onChangeText={(v) => setCardio({ ...cardio, distance: v })}
                keyboardType="decimal-pad"
                placeholder="8.0"
              />
              <TextField
                label="Sure (dakika)"
                value={cardio.duration}
                onChangeText={(v) => setCardio({ ...cardio, duration: v })}
                keyboardType="decimal-pad"
                placeholder="45"
              />
              <TextField
                label="Ortalama nabiz (opsiyonel)"
                value={cardio.avgHr}
                onChangeText={(v) => setCardio({ ...cardio, avgHr: v })}
                keyboardType="number-pad"
                placeholder="140"
              />
            </View>
          )}
        </View>

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <Button
          label="Idmani Kaydet"
          onPress={onSubmit}
          loading={logWorkout.isPending}
        />
      </View>

      <ExercisePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={addExercise}
        selectedIds={exercises.map((d) => d.exercise.exercise_id)}
      />

      <ResultSheet
        result={result}
        onClose={() => {
          setResult(null);
          resetForm();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.xxl,
  },
  title: {
    ...type.heading1,
    color: color.text.primary,
  },
  fieldGroup: {
    gap: space.md,
  },
  fieldLabel: {
    ...type.micro,
    color: color.text.secondary,
  },
  rpeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  rpePill: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    alignItems: "center",
    justifyContent: "center",
  },
  rpePillActive: {
    backgroundColor: color.accent.primary,
    borderColor: color.accent.primary,
  },
  rpeText: {
    fontFamily: font.data.medium,
    fontSize: 14,
    color: color.text.secondary,
  },
  rpeTextActive: {
    color: color.accent.ink,
  },
  exerciseCard: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exerciseName: {
    ...type.bodyStrong,
    color: color.text.primary,
  },
  cardioTypes: {
    flexDirection: "row",
    gap: space.sm,
  },
  measurementRow: {
    flexDirection: "row",
    gap: space.sm,
  },
  measurementPill: {
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  measurementPillActive: {
    backgroundColor: color.accent.primary,
    borderColor: color.accent.primary,
  },
  measurementText: {
    ...type.small,
    color: color.text.secondary,
  },
  measurementTextActive: {
    color: color.accent.ink,
    fontFamily: "Manrope_600SemiBold",
  },
  setHeaderRow: {
    flexDirection: "row",
    gap: space.sm,
  },
  setHeaderCell: {
    flex: 1,
    ...type.micro,
    color: color.text.disabled,
    textAlign: "center",
  },
  setRow: {
    flexDirection: "row",
    gap: space.sm,
    alignItems: "center",
  },
  setInput: {
    flex: 1,
    height: 44,
    backgroundColor: color.bg.base,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.sm,
    color: color.text.primary,
    fontFamily: font.data.regular,
    fontSize: 14,
    textAlign: "center",
  },
  setRemoveSpace: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  addSetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    paddingVertical: space.sm,
  },
  addSetText: {
    ...type.small,
    color: color.accent.primary,
    fontFamily: "Manrope_600SemiBold",
  },
  formError: {
    ...type.small,
    color: color.status.danger,
  },
});
