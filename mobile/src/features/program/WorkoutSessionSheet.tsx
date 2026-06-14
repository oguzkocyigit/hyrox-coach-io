/**
 * Canli idman oturumu: baslat / duraklat / sonlandir + tur takibi + loglama.
 */

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import { useExercises, useLogWorkout, useSetEntryCompletion } from "@/api/hooks";
import type { Exercise, WorkoutCreateResponse, WorkoutTemplate } from "@/api/types";
import {
  estimateDurationMinutes,
  exerciseSummary,
  formatMeta,
  formatUsesRounds,
  typeMeta,
} from "@/features/program/constants";
import { normalizeWorkoutTemplate, usesCircuitRounds } from "@/features/program/normalizeTemplate";
import {
  activeSetIndex,
  buildSessionPayload,
  formatElapsed,
  initSessionLogs,
  isExerciseDoneInRound,
  isRoundComplete,
  resolveExerciseId,
  totalCompletedSets,
  totalSetSlots,
  type SessionExerciseLog,
  type SetLogDraft,
} from "@/features/program/sessionLog";
import {
  clearPersistedSession,
  loadPersistedSession,
  parsePersistedRpe,
  savePersistedSession,
} from "@/features/program/sessionStore";
import { ResultSheet } from "@/features/workout-log/ResultSheet";
import { ExercisePicker } from "@/features/workout-log/ExercisePicker";
import { WhenField } from "@/features/workout-log/WhenField";
import {
  resolveWhen,
  startOfDay,
  todayWhen,
  type WhenState,
} from "@/features/workout-log/when";
import { Button } from "@/ui/Button";
import { color, font, radius, space, type } from "@/ui/tokens";

type SessionStatus = "idle" | "running" | "paused" | "finished";

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const JOURNAL_MAX_LENGTH = 1500;

type WorkoutSessionSheetProps = {
  visible: boolean;
  template: WorkoutTemplate | null;
  planEntryId?: string | null;
  onClose: () => void;
  onCompleted?: () => void;
};

function valueLabel(measurement: SessionExerciseLog["measurement"]): string {
  if (measurement === "reps") return "Tekrar";
  if (measurement === "distance") return "Mesafe (m)";
  return "Sure (sn)";
}

export function WorkoutSessionSheet({
  visible,
  template: rawTemplate,
  planEntryId,
  onClose,
  onCompleted,
}: WorkoutSessionSheetProps) {
  const insets = useSafeAreaInsets();
  const { data: catalog = [] } = useExercises();
  const logWorkout = useLogWorkout();
  const setCompletion = useSetEntryCompletion();

  const template = useMemo(
    () => (rawTemplate ? normalizeWorkoutTemplate(rawTemplate) : null),
    [rawTemplate],
  );

  const [status, setStatus] = useState<SessionStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [logs, setLogs] = useState<SessionExerciseLog[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [overallRpe, setOverallRpe] = useState<number | null>(null);
  const [journalNotes, setJournalNotes] = useState("");
  const [journalFocused, setJournalFocused] = useState(false);
  const [calories, setCalories] = useState("");
  const [useManualTime, setUseManualTime] = useState(false);
  const [manualWhen, setManualWhen] = useState<WhenState>(todayWhen);
  const [showFinishPanel, setShowFinishPanel] = useState(false);
  const [result, setResult] = useState<WorkoutCreateResponse | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const sessionTemplateIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!visible || !template) {
      sessionTemplateIdRef.current = null;
      hydratedRef.current = false;
      return;
    }

    const isNewSession = sessionTemplateIdRef.current !== template.template_id;
    if (!isNewSession && hydratedRef.current) return;

    sessionTemplateIdRef.current = template.template_id;
    hydratedRef.current = true;

    void (async () => {
      const saved = await loadPersistedSession(template.template_id);
      if (saved) {
        setStatus(saved.status);
        setElapsedSeconds(saved.elapsedSeconds);
        accumulatedRef.current = saved.accumulatedSeconds;
        startedAtRef.current =
          saved.status === "running" && saved.runningSince != null
            ? saved.runningSince
            : null;
        setLogs(saved.logs);
        setCurrentRound(saved.currentRound);
        setOverallRpe(parsePersistedRpe(saved.overallRpe));
        setJournalNotes(saved.journalNotes ?? "");
        setCalories(saved.calories ?? "");
        setUseManualTime(saved.useManualTime ?? false);
        setManualWhen({
          date: saved.manualDateISO ? startOfDay(new Date(saved.manualDateISO)) : startOfDay(new Date()),
          startMin: saved.manualStartMin ?? null,
          endMin: saved.manualEndMin ?? null,
        });
        setShowFinishPanel(saved.showFinishPanel);
        return;
      }

      setStatus("idle");
      setElapsedSeconds(0);
      setLogs(initSessionLogs(template, catalog));
      setCurrentRound(1);
      setEditingIndex(null);
      setOverallRpe(null);
      setJournalNotes("");
      setCalories("");
      setUseManualTime(false);
      setManualWhen(todayWhen());
      setShowFinishPanel(false);
      startedAtRef.current = null;
      accumulatedRef.current = 0;
    })();
  }, [visible, template, catalog]);

  useEffect(() => {
    if (!visible || !template || !hydratedRef.current) return;

    if (catalog.length === 0) return;
    setLogs((prev) => {
      if (prev.length !== template.exercises.length) {
        return initSessionLogs(template, catalog);
      }
      return prev.map((log, i) => ({
        ...log,
        resolvedExerciseId: log.resolvedExerciseId ?? resolveExerciseId(template.exercises[i], catalog),
      }));
    });
  }, [catalog, visible, template]);

  useEffect(() => {
    if (!visible || !template || !hydratedRef.current) return;

    void savePersistedSession({
      templateId: template.template_id,
      planEntryId: planEntryId ?? null,
      status,
      elapsedSeconds,
      accumulatedSeconds: accumulatedRef.current,
      runningSince: startedAtRef.current,
      currentRound,
      logs,
      overallRpe,
      journalNotes,
      calories,
      useManualTime,
      manualDateISO: startOfDay(manualWhen.date).toISOString(),
      manualStartMin: manualWhen.startMin,
      manualEndMin: manualWhen.endMin,
      showFinishPanel,
      savedAt: Date.now(),
    });
  }, [
    visible,
    template,
    planEntryId,
    status,
    elapsedSeconds,
    currentRound,
    logs,
    overallRpe,
    journalNotes,
    calories,
    useManualTime,
    manualWhen,
    showFinishPanel,
  ]);

  useEffect(() => {
    if (status !== "running") return;
    const tick = setInterval(() => {
      if (startedAtRef.current != null) {
        setElapsedSeconds(
          accumulatedRef.current + Math.floor((Date.now() - startedAtRef.current) / 1000),
        );
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [status]);

  if (!template) return null;

  const activeLogs =
    logs.length === template.exercises.length
      ? logs
      : initSessionLogs(template, catalog);

  const meta = typeMeta(template.workout_type);
  const fmt = formatMeta(template.format);
  const setIdx = activeSetIndex(template, currentRound);
  const circuitMode = usesCircuitRounds(template.format);
  const completedSets = totalCompletedSets(activeLogs);
  const totalSlots = totalSetSlots(template);

  const handleStart = () => {
    startedAtRef.current = Date.now();
    setStatus("running");
  };

  const handlePause = () => {
    if (startedAtRef.current != null) {
      accumulatedRef.current += Math.floor((Date.now() - startedAtRef.current) / 1000);
      startedAtRef.current = null;
    }
    setStatus("paused");
  };

  const handleResume = () => {
    startedAtRef.current = Date.now();
    setStatus("running");
  };

  const handleFinishPress = () => {
    if (startedAtRef.current != null) {
      accumulatedRef.current += Math.floor((Date.now() - startedAtRef.current) / 1000);
      startedAtRef.current = null;
    }
    setElapsedSeconds(accumulatedRef.current);
    setStatus("finished");
    setShowFinishPanel(true);
  };

  // Sabah baslatmayi unutmus olabilir: timer'i hic baslatmadan dogrudan
  // kayit paneline gecip baslangic/bitis saatini elle girer.
  const handleManualEntry = () => {
    setUseManualTime(true);
    setStatus("finished");
    setShowFinishPanel(true);
  };

  const updateSetLog = (
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<SetLogDraft>,
  ) => {
    setLogs((prev) => {
      const base =
        prev.length === template.exercises.length
          ? prev
          : initSessionLogs(template, catalog);
      return base.map((item, i) => {
        if (i !== exerciseIndex) return item;
        return {
          ...item,
          sets: item.sets.map((set, j) => (j === setIndex ? { ...set, ...patch } : set)),
        };
      });
    });
  };

  const handleClose = () => {
    if (status !== "idle" && status !== "finished") {
      Alert.alert(
        "Oturumu kapat",
        "Devam eden idman kaydedildi; sonra ayni idmandan devam edebilirsin.",
        [{ text: "Tamam", onPress: onClose }],
      );
      return;
    }
    onClose();
  };

  const submitWorkout = async () => {
    if (overallRpe !== null && (overallRpe < 1 || overallRpe > 10)) {
      Alert.alert("Hata", "Genel RPE 1-10 arasi olmali.");
      return;
    }

    const resolved = resolveWhen(manualWhen);
    let durationMinutes = Math.max(1, elapsedSeconds / 60);
    let dateISO: string | null = null;

    if (useManualTime) {
      dateISO = resolved.dateISO;
      if (resolved.durationMinutes != null) {
        // Baslangic + bitis saati girildiyse sureyi oradan al.
        durationMinutes = resolved.durationMinutes;
      } else if (elapsedSeconds < 1) {
        // Hizli (gecmise donuk) kayit: sure zorunlu degil, sablon tahmininden turet.
        durationMinutes = estimateDurationMinutes(template);
      }
    }

    let caloriesBurned: number | null = null;
    if (calories.trim() !== "") {
      const c = Number(calories.trim().replace(",", "."));
      if (!Number.isFinite(c) || c < 0 || c > 20000) {
        Alert.alert("Hata", "Kalori 0-20000 arasi olmali (kcal).");
        return;
      }
      caloriesBurned = Math.round(c);
    }

    const built = buildSessionPayload({
      template,
      logs: activeLogs,
      durationMinutes,
      overallRpe,
      journalNotes,
      caloriesBurned,
      dateISO,
    });
    if (!built.ok) {
      Alert.alert("Hata", built.message);
      return;
    }

    try {
      const response = await logWorkout.mutateAsync(built.payload);
      if (planEntryId) {
        await setCompletion.mutateAsync({ entryId: planEntryId, completed: true });
      }
      await clearPersistedSession();
      onCompleted?.();
      setResult(response);
      setShowFinishPanel(false);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Kayit basarisiz.";
      Alert.alert("Hata", msg);
    }
  };

  const canLog = status === "running" || status === "paused" || status === "finished";
  const editing = editingIndex != null ? activeLogs[editingIndex] : null;
  const editingExercise =
    editingIndex != null ? template.exercises[editingIndex] : null;
  const editingSet = editing?.sets[setIdx];

  return (
    <>
      <Modal visible={visible && result == null} animationType="slide" onRequestClose={handleClose}>
        <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
          <View style={styles.header}>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={color.text.secondary} />
            </Pressable>
            <Text style={styles.headerTitle}>Canli Idman</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.timerCard}>
              <Text style={styles.timerLabel}>SURE</Text>
              <Text style={styles.timerValue}>{formatElapsed(elapsedSeconds)}</Text>
              <Text style={styles.timerMeta}>
                {circuitMode
                  ? `Tur ${currentRound}/${template.rounds} · ${completedSets}/${totalSlots} istasyon`
                  : `${completedSets}/${totalSlots} set tamamlandi`}
              </Text>
            </View>

            <View style={styles.controlRow}>
              {status === "idle" ? (
                <>
                  <ControlButton icon="play" label="Baslat" tone="primary" onPress={handleStart} />
                  <ControlButton
                    icon="flash"
                    label="Hizli Tamamla"
                    tone="neutral"
                    onPress={handleManualEntry}
                  />
                </>
              ) : null}
              {status === "running" ? (
                <>
                  <ControlButton icon="pause" label="Duraklat" tone="neutral" onPress={handlePause} />
                  <ControlButton icon="stop" label="Sonlandir" tone="primary" onPress={handleFinishPress} />
                </>
              ) : null}
              {status === "paused" ? (
                <>
                  <ControlButton icon="play" label="Devam" tone="primary" onPress={handleResume} />
                  <ControlButton icon="stop" label="Sonlandir" tone="neutral" onPress={handleFinishPress} />
                </>
              ) : null}
            </View>

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
            </View>

            <Text style={styles.title}>{template.name}</Text>
            <Text style={styles.subtitle}>
              Tahmini {estimateDurationMinutes(template)} dk · {fmt.description}
            </Text>

            <Text style={styles.sectionLabel}>
              {circuitMode ? `Tur ${currentRound} — Egzersizler` : "Egzersizler"}
            </Text>
            {template.exercises.map((exercise, index) => {
              const log = activeLogs[index];
              if (!log) return null;
              const done = isExerciseDoneInRound(log, setIdx);
              const setDraft = log.sets[setIdx];
              return (
                <Pressable
                  key={`${exercise.name}-${index}`}
                  disabled={!canLog}
                  onPress={() => setEditingIndex(index)}
                  style={[
                    styles.exerciseRow,
                    done && styles.exerciseRowDone,
                    !canLog && styles.exerciseRowDisabled,
                  ]}
                >
                  <View style={[styles.orderBadge, done && styles.orderBadgeDone]}>
                    {done ? (
                      <Ionicons name="checkmark" size={14} color={color.accent.ink} />
                    ) : (
                      <Text style={styles.orderText}>{index + 1}</Text>
                    )}
                  </View>
                  <View style={styles.exerciseTexts}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {exerciseSummary(exercise, template.format)}
                    </Text>
                    {done && setDraft ? (
                      <Text style={styles.loggedHint}>
                        Kayit: {setDraft.value}
                        {log.measurement === "distance" ? "m" : ""}
                        {setDraft.rpe.trim() ? ` · RPE ${setDraft.rpe}` : ""}
                      </Text>
                    ) : canLog ? (
                      <Text style={styles.tapHint}>Tamamla ve deger gir</Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={done ? "create-outline" : "ellipse-outline"}
                    size={20}
                    color={done ? color.accent.primary : color.stroke.strong}
                  />
                </Pressable>
              );
            })}

            {showFinishPanel ? (
              <View style={styles.finishPanel}>
                <Text style={styles.sectionLabel}>IDMANI KAYDET</Text>

                {useManualTime ? (
                  <View style={styles.finishFieldGroup}>
                    <WhenField value={manualWhen} onChange={setManualWhen} />
                  </View>
                ) : (
                  <Pressable
                    style={styles.manualToggle}
                    onPress={() => setUseManualTime(true)}
                  >
                    <Ionicons name="time-outline" size={16} color={color.accent.primary} />
                    <Text style={styles.manualToggleText}>
                      Saati/tarihi elle gir (baslatmayi unuttuysan)
                    </Text>
                  </Pressable>
                )}

                <View style={styles.finishFieldGroup}>
                  <Text style={styles.finishFieldLabel}>KALORI (KCAL) — OPSIYONEL</Text>
                  <TextInput
                    style={styles.caloriesInput}
                    value={calories}
                    onChangeText={setCalories}
                    keyboardType="number-pad"
                    placeholder="450"
                    placeholderTextColor={color.text.disabled}
                    accessibilityLabel="Harcanan kalori"
                  />
                </View>

                <View style={styles.finishFieldGroup}>
                  <Text style={styles.finishFieldLabel}>IDMAN GENELI RPE</Text>
                  <Text style={styles.finishHint}>
                    Genel zorluk (1-10). Bos birakirsan 7 kabul edilir.
                  </Text>
                  <View style={styles.rpeRow}>
                    {RPE_VALUES.map((value) => {
                      const active = overallRpe === value;
                      return (
                        <Pressable
                          key={value}
                          onPress={() => setOverallRpe(value)}
                          style={[styles.rpePill, active && styles.rpePillActive]}
                          accessibilityLabel={`RPE ${value}`}
                          accessibilityState={{ selected: active }}
                        >
                          <Text style={[styles.rpeText, active && styles.rpeTextActive]}>
                            {value}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.finishFieldGroup}>
                  <Text style={styles.finishFieldLabel}>IDMAN GUNLUGU (OPSIYONEL)</Text>
                  <TextInput
                    style={[
                      styles.journalInput,
                      journalFocused && styles.journalInputFocused,
                    ]}
                    value={journalNotes}
                    onChangeText={setJournalNotes}
                    onFocus={() => setJournalFocused(true)}
                    onBlur={() => setJournalFocused(false)}
                    multiline
                    maxLength={JOURNAL_MAX_LENGTH}
                    textAlignVertical="top"
                    placeholder="Idman nasil hissettirdi? OMAD/Karb dongun enerjini nasil etkiledi? Buraya not dus..."
                    placeholderTextColor={color.text.disabled}
                    accessibilityLabel="Idman gunlugu"
                  />
                  {journalNotes.length > 0 ? (
                    <Text style={styles.journalCounter}>
                      {journalNotes.length}/{JOURNAL_MAX_LENGTH}
                    </Text>
                  ) : null}
                </View>

                <Button
                  label="Kaydet ve Bitir"
                  onPress={() => void submitWorkout()}
                  loading={logWorkout.isPending || setCompletion.isPending}
                />
              </View>
            ) : null}
          </ScrollView>

          {editing && editingExercise && editingSet ? (
            <View style={styles.logOverlay}>
              <View style={[styles.logSheet, { paddingBottom: insets.bottom + space.lg }]}>
                <Text style={styles.logTitle}>{editingExercise.name}</Text>
                <Text style={styles.logSubtitle}>
                  {circuitMode ? `Tur ${currentRound} · ` : ""}
                  {exerciseSummary(editingExercise, template.format)}
                </Text>

                {!editing.resolvedExerciseId ? (
                  <Pressable
                    style={styles.linkRow}
                    onPress={() => setPickerVisible(true)}
                  >
                    <Ionicons name="search-outline" size={16} color={color.accent.primary} />
                    <Text style={styles.linkText}>Katalogdan eslestir</Text>
                  </Pressable>
                ) : null}

                <Text style={styles.fieldLabel}>AGIRLIK (KG)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editingSet.weight}
                  onChangeText={(v) => updateSetLog(editingIndex!, setIdx, { weight: v })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={color.text.secondary}
                />

                <Text style={styles.fieldLabel}>{valueLabel(editing.measurement).toUpperCase()}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editingSet.value}
                  onChangeText={(v) => updateSetLog(editingIndex!, setIdx, { value: v })}
                  keyboardType="decimal-pad"
                  placeholder="Deger"
                  placeholderTextColor={color.text.secondary}
                />

                <Text style={styles.fieldLabel}>RPE (OPSIYONEL)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editingSet.rpe}
                  onChangeText={(v) => updateSetLog(editingIndex!, setIdx, { rpe: v })}
                  keyboardType="decimal-pad"
                  placeholder="1-10"
                  placeholderTextColor={color.text.secondary}
                />

                <View style={styles.logActions}>
                  <View style={styles.logActionItem}>
                    <Button
                      label="Iptal"
                      variant="secondary"
                      onPress={() => setEditingIndex(null)}
                    />
                  </View>
                  <View style={styles.logActionItem}>
                  <Button
                    label="Tamamlandi"
                    onPress={() => {
                      setLogs((prev) => {
                        const base =
                          prev.length === template.exercises.length
                            ? prev
                            : initSessionLogs(template, catalog);
                        const next = base.map((item, i) => {
                          if (i !== editingIndex) return item;
                          return {
                            ...item,
                            sets: item.sets.map((s, j) =>
                              j === setIdx ? { ...s, completed: true } : s,
                            ),
                          };
                        });
                        if (
                          circuitMode &&
                          isRoundComplete(next, setIdx) &&
                          currentRound < template.rounds
                        ) {
                          setCurrentRound((r) => r + 1);
                        }
                        return next;
                      });
                      setEditingIndex(null);
                    }}
                  />
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          {logWorkout.isPending ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={color.accent.primary} />
            </View>
          ) : null}
        </View>
      </Modal>

      <ExercisePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        title="Katalogdan Eslestir"
        onSelect={(exercise: Exercise) => {
          if (editingIndex == null) return;
          setLogs((prev) =>
            prev.map((item, i) =>
              i === editingIndex ? { ...item, resolvedExerciseId: exercise.exercise_id } : item,
            ),
          );
          setPickerVisible(false);
        }}
      />

      <ResultSheet
        result={result}
        onClose={() => {
          setResult(null);
          onClose();
        }}
      />
    </>
  );
}

type ControlButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone: "primary" | "neutral";
  onPress: () => void;
};

function ControlButton({ icon, label, tone, onPress }: ControlButtonProps) {
  const primary = tone === "primary";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.control,
        primary ? styles.controlPrimary : styles.controlNeutral,
        pressed && styles.controlPressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={primary ? color.accent.ink : color.text.primary}
      />
      <Text style={[styles.controlText, primary ? styles.controlTextPrimary : styles.controlTextNeutral]}>
        {label}
      </Text>
    </Pressable>
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
  headerTitle: {
    ...type.bodyStrong,
    color: color.text.primary,
  },
  content: {
    gap: space.md,
  },
  timerCard: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.accent.primary,
    borderRadius: radius.lg,
    padding: space.lg,
    alignItems: "center",
    gap: space.xs,
  },
  timerLabel: {
    ...type.micro,
    color: color.text.secondary,
  },
  timerValue: {
    fontFamily: font.body.semibold,
    fontSize: 42,
    color: color.accent.primary,
    fontVariant: ["tabular-nums"],
  },
  timerMeta: {
    ...type.small,
    color: color.text.secondary,
    textAlign: "center",
  },
  controlRow: {
    flexDirection: "row",
    gap: space.sm,
  },
  control: {
    flex: 1,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderRadius: radius.md,
  },
  controlPrimary: {
    backgroundColor: color.accent.primary,
  },
  controlNeutral: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.strong,
  },
  controlPressed: {
    opacity: 0.85,
  },
  controlText: {
    fontFamily: font.body.semibold,
    fontSize: 15,
  },
  controlTextPrimary: {
    color: color.accent.ink,
  },
  controlTextNeutral: {
    color: color.text.primary,
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
  subtitle: {
    ...type.small,
    color: color.text.secondary,
  },
  sectionLabel: {
    ...type.micro,
    color: color.accent.primary,
    marginTop: space.sm,
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
  exerciseRowDone: {
    borderColor: color.accent.primary,
    backgroundColor: color.accent.subtle,
  },
  exerciseRowDisabled: {
    opacity: 0.65,
  },
  orderBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: color.bg.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  orderBadgeDone: {
    backgroundColor: color.accent.primary,
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
  loggedHint: {
    ...type.small,
    color: color.accent.primary,
  },
  tapHint: {
    ...type.small,
    color: color.text.secondary,
    fontStyle: "italic",
  },
  finishPanel: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.lg,
    marginTop: space.md,
  },
  finishFieldGroup: {
    gap: space.sm,
  },
  manualToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  manualToggleText: {
    ...type.small,
    color: color.accent.primary,
  },
  caloriesInput: {
    backgroundColor: color.bg.elevated,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: color.text.primary,
    ...type.body,
  },
  finishFieldLabel: {
    ...type.micro,
    color: color.text.secondary,
  },
  finishHint: {
    ...type.small,
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
    backgroundColor: color.bg.elevated,
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
  journalInput: {
    backgroundColor: color.bg.elevated,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    minHeight: 128,
    color: color.text.primary,
    ...type.body,
  },
  journalInputFocused: {
    borderColor: color.accent.primary,
  },
  journalCounter: {
    ...type.small,
    color: color.text.disabled,
    textAlign: "right",
  },
  logOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  logSheet: {
    backgroundColor: color.bg.base,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.xl,
    gap: space.sm,
  },
  logTitle: {
    ...type.heading1,
    color: color.text.primary,
  },
  logSubtitle: {
    ...type.small,
    color: color.text.secondary,
    marginBottom: space.sm,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    marginBottom: space.sm,
  },
  linkText: {
    ...type.small,
    color: color.accent.primary,
  },
  fieldLabel: {
    ...type.micro,
    color: color.text.secondary,
    marginTop: space.xs,
  },
  fieldInput: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: color.text.primary,
    ...type.body,
  },
  logActions: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.md,
  },
  logActionItem: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
});
