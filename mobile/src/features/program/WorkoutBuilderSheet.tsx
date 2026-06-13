/**
 * "Build Workout" modali (RoxHype karsiligi): ad, idman tipi, format
 * (Standard/Circuit/EMOM/AMRAP/For Time), tur/sure limiti ve egzersiz listesi.
 * Hem yeni sablon olusturma hem mevcut sablonu duzenleme icin kullanilir.
 */

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCreateTemplate, useGenerateDayWorkout, useSuggestExercise, useUpdateTemplate } from "@/api/hooks";
import type {
  Exercise,
  ExerciseSuggestResponse,
  PlanEntry,
  PlanWorkoutType,
  SessionKind,
  SuggestMode,
  TemplateExercise,
  WeeklyDayContext,
  WorkoutFormat,
  WorkoutTemplate,
  WorkoutTemplateCreate,
} from "@/api/types";
import {
  buildAthleteContext,
  useOnboardingStore,
} from "@/features/onboarding/store";
import { ExerciseAddMenuSheet } from "@/features/program/ExerciseAddMenuSheet";
import { ExerciseEditorSheet } from "@/features/program/ExerciseEditorSheet";
import { ExerciseSuggestPreviewSheet } from "@/features/program/ExerciseSuggestPreviewSheet";
import {
  estimateDurationMinutes,
  exerciseSummary,
  formatMeta,
  formatUsesRounds,
  formatUsesTimeCap,
  WORKOUT_FORMATS,
  WORKOUT_TYPES,
} from "@/features/program/constants";
import { dayOfWeekFromIso } from "@/features/program/weekContext";
import { ExercisePicker } from "@/features/workout-log/ExercisePicker";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";
import { color, radius, space, type } from "@/ui/tokens";

type WorkoutBuilderSheetProps = {
  visible: boolean;
  /** null: yeni sablon; dolu: duzenleme */
  template: WorkoutTemplate | null;
  /** Haftalik plan baglami (AI onerileri icin) */
  weekEntries?: PlanEntry[];
  /** Bu idmanin atanacagi gun (ISO); yoksa bugun */
  scheduledDate?: string | null;
  onClose: () => void;
  /** Kayit basariliysa olusan/guncellenen sablonla cagrilir */
  onSaved?: (template: WorkoutTemplate) => void;
};

function sessionKindFromType(t: PlanWorkoutType): SessionKind {
  if (t === "running" || t === "endurance") return "running";
  if (t === "hybrid" || t === "metcon") return "hybrid";
  return "gym";
}

export function WorkoutBuilderSheet({
  visible,
  template,
  weekEntries = [],
  scheduledDate = null,
  onClose,
  onSaved,
}: WorkoutBuilderSheetProps) {
  const insets = useSafeAreaInsets();
  const onboarding = useOnboardingStore();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const suggestExercise = useSuggestExercise();
  const generateDay = useGenerateDayWorkout();

  const weeklyContext = useMemo((): WeeklyDayContext[] => {
    const DAY_NAMES = [
      "Pazartesi",
      "Sali",
      "Carsamba",
      "Persembe",
      "Cuma",
      "Cumartesi",
      "Pazar",
    ];
    return weekEntries.map((entry) => {
      const dow = dayOfWeekFromIso(entry.scheduled_date);
      return {
        day_of_week: dow,
        day_name: DAY_NAMES[dow] ?? `Gun ${dow + 1}`,
        workout_name: entry.template.name,
        exercise_names: entry.template.exercises.map((e) => e.name),
      };
    });
  }, [weekEntries]);

  const dayOfWeek = useMemo(() => {
    if (scheduledDate) return dayOfWeekFromIso(scheduledDate);
    return (new Date().getDay() + 6) % 7;
  }, [scheduledDate]);

  const [name, setName] = useState("");
  const [workoutType, setWorkoutType] = useState<PlanWorkoutType>("hybrid");
  const [format, setFormat] = useState<WorkoutFormat>("standard");
  const [rounds, setRounds] = useState("1");
  const [timeCap, setTimeCap] = useState("");
  const [exercises, setExercises] = useState<TemplateExercise[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editorVisible, setEditorVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [catalogPick, setCatalogPick] = useState<Pick<Exercise, "exercise_id" | "name"> | null>(
    null,
  );
  const [customNamePrefill, setCustomNamePrefill] = useState("");
  const [addMenuVisible, setAddMenuVisible] = useState(false);
  const [suggestVisible, setSuggestVisible] = useState(false);
  const [suggestMode, setSuggestMode] = useState<SuggestMode>("append");
  const [suggestReplaceIndex, setSuggestReplaceIndex] = useState<number | null>(null);
  const [suggestResult, setSuggestResult] = useState<ExerciseSuggestResponse | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [fillingAi, setFillingAi] = useState(false);
  const [suggestEditInitial, setSuggestEditInitial] = useState<TemplateExercise | null>(null);

  const closeEditor = () => {
    setEditorVisible(false);
    setCatalogPick(null);
    setCustomNamePrefill("");
    setSuggestEditInitial(null);
  };

  const openAddFlow = () => {
    setEditingIndex(null);
    setCatalogPick(null);
    setCustomNamePrefill("");
    setAddMenuVisible(true);
  };

  const buildSuggestPayload = (mode: SuggestMode, replaceIndex: number | null) => ({
    mode,
    workout_name: name.trim() || "Idman",
    workout_type: workoutType,
    format,
    rounds: parsedRounds,
    time_cap_minutes: parsedTimeCap,
    existing_exercises: exercises,
    replace_index: replaceIndex,
    weekly_context: weeklyContext,
    day_of_week: dayOfWeek,
    athlete_context: buildAthleteContext(onboarding),
  });

  const requestAISuggest = async (mode: SuggestMode, replaceIndex: number | null) => {
    setSuggestMode(mode);
    setSuggestReplaceIndex(replaceIndex);
    setSuggestResult(null);
    setSuggestError(null);
    setSuggestVisible(true);
    try {
      const result = await suggestExercise.mutateAsync(
        buildSuggestPayload(mode, replaceIndex),
      );
      setSuggestResult(result);
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : "AI onerisi alinamadi.");
    }
  };

  const applySuggestResult = (exercise: TemplateExercise, mode: SuggestMode, index: number | null) => {
    setExercises((list) => {
      if (mode === "replace" && index != null) {
        const next = [...list];
        next[index] = exercise;
        return next;
      }
      return [...list, exercise];
    });
  };

  const closeSuggestPreview = () => {
    setSuggestVisible(false);
    setSuggestResult(null);
    setSuggestError(null);
    setSuggestReplaceIndex(null);
  };

  const fillWorkoutWithAI = async () => {
    setFillingAi(true);
    setError(null);
    try {
      const result = await generateDay.mutateAsync({
        day_of_week: dayOfWeek,
        session_kind: sessionKindFromType(workoutType),
        duration_minutes: estimatedMinutes > 0 ? estimatedMinutes : 60,
        preferred_workout_type: workoutType,
        athlete_context: buildAthleteContext(onboarding),
      });
      const t = result.template;
      if (!name.trim()) setName(t.name);
      setWorkoutType(t.workout_type);
      setFormat(t.format);
      setRounds(String(t.rounds));
      setTimeCap(t.time_cap_minutes ? String(t.time_cap_minutes) : "");
      setExercises(t.exercises);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI idman olusturulamadi.");
    } finally {
      setFillingAi(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setError(null);
    if (template) {
      setName(template.name);
      setWorkoutType(template.workout_type);
      setFormat(template.format);
      setRounds(String(template.rounds));
      setTimeCap(template.time_cap_minutes ? String(template.time_cap_minutes) : "");
      setExercises(template.exercises);
    } else {
      setName("");
      setWorkoutType("hybrid");
      setFormat("standard");
      setRounds("1");
      setTimeCap("");
      setExercises([]);
    }
  }, [visible, template]);

  const parsedRounds = Math.max(1, Number.parseInt(rounds, 10) || 1);
  const parsedTimeCap = Number.parseInt(timeCap, 10) || null;

  const estimatedMinutes = useMemo(
    () =>
      exercises.length === 0
        ? 0
        : estimateDurationMinutes({
            exercises,
            rounds: parsedRounds,
            format,
            time_cap_minutes: parsedTimeCap,
          }),
    [exercises, parsedRounds, format, parsedTimeCap],
  );

  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  const moveExercise = (index: number, direction: -1 | 1) => {
    setExercises((list) => {
      const target = index + direction;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeExercise = (index: number) => {
    Alert.alert("Egzersizi Kaldir", `${exercises[index].name} listeden cikarilsin mi?`, [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Kaldir",
        style: "destructive",
        onPress: () => setExercises((list) => list.filter((_, i) => i !== index)),
      },
    ]);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return setError("Idman adi gerekli.");
    if (exercises.length === 0) return setError("En az bir egzersiz ekleyin.");
    setError(null);

    const payload: WorkoutTemplateCreate = {
      name: trimmedName,
      workout_type: workoutType,
      format,
      rounds: formatUsesRounds(format) ? parsedRounds : 1,
      time_cap_minutes: formatUsesTimeCap(format) ? parsedTimeCap : null,
      exercises,
    };

    try {
      const saved = template
        ? await updateTemplate.mutateAsync({
            templateId: template.template_id,
            payload,
          })
        : await createTemplate.mutateAsync(payload);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kayit basarisiz.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
            <Ionicons name="close" size={24} color={color.text.secondary} />
          </Pressable>
          <Text style={styles.title}>
            {template ? "Idmani Duzenle" : "Idman Olustur"}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <TextField
            label="Idman Adi"
            value={name}
            onChangeText={setName}
            placeholder="orn. HYROX Half-Distance Grinder"
            autoCapitalize="words"
          />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Idman Tipi</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.pillRow}>
                {WORKOUT_TYPES.map((t) => {
                  const active = workoutType === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setWorkoutType(t.id)}
                      style={[styles.pill, active && styles.pillOutlineActive]}
                    >
                      <View style={[styles.dot, { backgroundColor: t.dot }]} />
                      <Text
                        style={[styles.pillText, active && styles.pillOutlineTextActive]}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Idman Formati</Text>
            <View style={styles.formatGrid}>
              {WORKOUT_FORMATS.map((f) => {
                const active = format === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setFormat(f.id)}
                    style={[styles.pill, active && styles.pillOutlineActive]}
                  >
                    <Text
                      style={[styles.pillText, active && styles.pillOutlineTextActive]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.formatHint}>{formatMeta(format).description}</Text>
          </View>

          {formatUsesRounds(format) ? (
            <View style={styles.inlineField}>
              <Text style={styles.inlineLabel}>Tur Sayisi</Text>
              <TextField
                label=""
                value={rounds}
                onChangeText={setRounds}
                keyboardType="number-pad"
              />
            </View>
          ) : null}

          {formatUsesTimeCap(format) ? (
            <View style={styles.inlineField}>
              <Text style={styles.inlineLabel}>Sure Limiti (dk)</Text>
              <TextField
                label=""
                value={timeCap}
                onChangeText={setTimeCap}
                keyboardType="number-pad"
                placeholder="20"
              />
            </View>
          ) : null}

          {estimatedMinutes > 0 ? (
            <View style={styles.estimateBox}>
              <Ionicons name="time-outline" size={16} color={color.text.secondary} />
              <Text style={styles.estimateText}>
                Tahmini Sure: {estimatedMinutes} dakika
              </Text>
            </View>
          ) : null}

          <View style={styles.exerciseHeader}>
            <Text style={styles.sectionTitle}>Egzersizler</Text>
            <View style={styles.exerciseHeaderActions}>
              {exercises.length === 0 ? (
                <Pressable
                  onPress={() => void fillWorkoutWithAI()}
                  disabled={fillingAi || generateDay.isPending}
                  hitSlop={8}
                  style={styles.aiFillButton}
                  accessibilityLabel="AI ile idmani doldur"
                >
                  <Ionicons name="sparkles" size={16} color={color.accent.primary} />
                  <Text style={styles.aiFillText}>
                    {fillingAi ? "..." : "AI ile Doldur"}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={openAddFlow}
                hitSlop={8}
                style={styles.addExercise}
                accessibilityLabel="Egzersiz ekle"
              >
                <Ionicons name="add-circle" size={20} color={color.accent.primary} />
                <Text style={styles.addExerciseText}>Ekle</Text>
              </Pressable>
            </View>
          </View>

          {exercises.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyExercises}>
                Henuz egzersiz yok. AI ile doldur veya Ekle ile basla.
              </Text>
            </View>
          ) : (
            exercises.map((exercise, index) => (
              <View key={`${exercise.name}-${index}`} style={styles.exerciseRow}>
                <View style={styles.orderBadge}>
                  <Text style={styles.orderText}>{index + 1}</Text>
                </View>
                <View style={styles.exerciseTexts}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseMeta}>{exerciseSummary(exercise)}</Text>
                </View>
                <View style={styles.exerciseActions}>
                  <Pressable
                    onPress={() => moveExercise(index, -1)}
                    hitSlop={6}
                    disabled={index === 0}
                    accessibilityLabel="Yukari tasi"
                  >
                    <Ionicons
                      name="chevron-up"
                      size={18}
                      color={index === 0 ? color.text.disabled : color.text.secondary}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => moveExercise(index, 1)}
                    hitSlop={6}
                    disabled={index === exercises.length - 1}
                    accessibilityLabel="Asagi tasi"
                  >
                    <Ionicons
                      name="chevron-down"
                      size={18}
                      color={
                        index === exercises.length - 1
                          ? color.text.disabled
                          : color.text.secondary
                      }
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setEditingIndex(index);
                      setEditorVisible(true);
                    }}
                    hitSlop={6}
                    accessibilityLabel="Duzenle"
                  >
                    <Ionicons name="create-outline" size={18} color={color.text.secondary} />
                  </Pressable>
                  <Pressable
                    onPress={() => void requestAISuggest("replace", index)}
                    hitSlop={6}
                    accessibilityLabel="AI ile degistir"
                  >
                    <Ionicons name="sparkles-outline" size={18} color={color.accent.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => removeExercise(index)}
                    hitSlop={6}
                    accessibilityLabel="Sil"
                  >
                    <Ionicons name="trash-outline" size={18} color={color.status.danger} />
                  </Pressable>
                </View>
              </View>
            ))
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.footerButton}>
            <Button label="Vazgec" variant="secondary" size="lg" onPress={onClose} />
          </View>
          <View style={styles.footerButton}>
            <Button
              label={template ? "Kaydet" : "Idmani Kaydet"}
              size="lg"
              onPress={handleSave}
              loading={isSaving}
            />
          </View>
        </View>
      </View>

      <ExerciseAddMenuSheet
        visible={addMenuVisible}
        onClose={() => setAddMenuVisible(false)}
        onPickAI={() => void requestAISuggest("append", null)}
        onPickCatalog={() => setPickerVisible(true)}
        onPickCustom={() => {
          setCatalogPick(null);
          setCustomNamePrefill("");
          setEditorVisible(true);
        }}
      />

      <ExercisePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        allowCustom
        onSelect={(exercise) => {
          setCatalogPick({ exercise_id: exercise.exercise_id, name: exercise.name });
          setCustomNamePrefill("");
          setPickerVisible(false);
          setEditorVisible(true);
        }}
        onCreateCustom={(prefillName) => {
          setCatalogPick(null);
          setCustomNamePrefill(prefillName);
          setPickerVisible(false);
          setEditorVisible(true);
        }}
      />

      <ExerciseEditorSheet
        visible={editorVisible}
        initial={
          suggestEditInitial ??
          (editingIndex != null ? exercises[editingIndex] : null)
        }
        catalogExercise={editingIndex == null ? catalogPick : null}
        namePrefill={editingIndex == null && !catalogPick ? customNamePrefill : ""}
        onClose={closeEditor}
        onSave={(exercise) => {
          setExercises((list) => {
            if (editingIndex == null) return [...list, exercise];
            const next = [...list];
            next[editingIndex] = exercise;
            return next;
          });
          closeEditor();
        }}
      />

      <ExerciseSuggestPreviewSheet
        visible={suggestVisible}
        loading={suggestExercise.isPending}
        error={suggestError}
        result={suggestResult}
        mode={suggestMode}
        onClose={closeSuggestPreview}
        onAccept={() => {
          if (!suggestResult) return;
          applySuggestResult(suggestResult.exercise, suggestMode, suggestReplaceIndex);
          closeSuggestPreview();
        }}
        onEdit={() => {
          if (!suggestResult) return;
          const ex = suggestResult.exercise;
          setSuggestEditInitial(ex);
          if (suggestMode === "replace" && suggestReplaceIndex != null) {
            setEditingIndex(suggestReplaceIndex);
          } else {
            setEditingIndex(null);
          }
          setCatalogPick(
            ex.exercise_id ? { exercise_id: ex.exercise_id, name: ex.name } : null,
          );
          closeSuggestPreview();
          setEditorVisible(true);
        }}
        onRetry={() => void requestAISuggest(suggestMode, suggestReplaceIndex)}
      />
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
  headerSpacer: {
    width: 24,
  },
  title: {
    ...type.heading2,
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
  sectionTitle: {
    ...type.heading2,
    color: color.text.primary,
  },
  pillRow: {
    flexDirection: "row",
    gap: space.sm,
  },
  formatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs + 2,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    backgroundColor: color.bg.surface,
  },
  pillOutlineActive: {
    borderColor: color.accent.primary,
    backgroundColor: color.accent.subtle,
  },
  pillText: {
    ...type.small,
    color: color.text.secondary,
  },
  pillOutlineTextActive: {
    color: color.text.primary,
    fontFamily: "Manrope_600SemiBold",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  formatHint: {
    ...type.small,
    color: color.text.secondary,
  },
  inlineField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.lg,
  },
  inlineLabel: {
    ...type.bodyStrong,
    color: color.text.primary,
    flex: 1,
  },
  estimateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: color.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    padding: space.md,
  },
  estimateText: {
    ...type.small,
    color: color.text.secondary,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  exerciseHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  aiFillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    borderWidth: 1,
    borderColor: color.accent.primary,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    backgroundColor: color.accent.subtle,
  },
  aiFillText: {
    ...type.small,
    color: color.accent.primary,
    fontFamily: "Manrope_600SemiBold",
  },
  addExercise: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  addExerciseText: {
    ...type.bodyStrong,
    color: color.accent.primary,
  },
  emptyBox: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    padding: space.lg,
  },
  emptyExercises: {
    ...type.body,
    color: color.text.secondary,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
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
  exerciseActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
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
