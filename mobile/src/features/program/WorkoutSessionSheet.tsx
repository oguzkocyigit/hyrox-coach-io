/**
 * Canli idman oturumu: baslat / duraklat / sonlandir + egzersiz loglama.
 */

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
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
import type { WorkoutTemplate } from "@/api/types";
import {
  estimateDurationMinutes,
  exerciseSummary,
  formatMeta,
  formatUsesRounds,
  typeMeta,
} from "@/features/program/constants";
import {
  buildSessionPayload,
  formatElapsed,
  initSessionLogs,
  type SessionExerciseLog,
} from "@/features/program/sessionLog";
import { Button } from "@/ui/Button";
import { color, font, radius, space, type } from "@/ui/tokens";

type SessionStatus = "idle" | "running" | "paused" | "finished";

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
  template,
  planEntryId,
  onClose,
  onCompleted,
}: WorkoutSessionSheetProps) {
  const insets = useSafeAreaInsets();
  const { data: catalog = [] } = useExercises();
  const logWorkout = useLogWorkout();
  const setCompletion = useSetEntryCompletion();

  const [status, setStatus] = useState<SessionStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [logs, setLogs] = useState<SessionExerciseLog[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [overallRpe, setOverallRpe] = useState("");
  const [showFinishPanel, setShowFinishPanel] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);

  useEffect(() => {
    if (!visible || !template) return;
    setStatus("idle");
    setElapsedSeconds(0);
    setLogs(initSessionLogs(template, catalog));
    setEditingIndex(null);
    setOverallRpe("");
    setShowFinishPanel(false);
    startedAtRef.current = null;
    accumulatedRef.current = 0;
  }, [visible, template, catalog]);

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

  const meta = typeMeta(template.workout_type);
  const fmt = formatMeta(template.format);
  const completedCount = logs.filter((l) => l.completed).length;

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

  const updateLog = (index: number, patch: Partial<SessionExerciseLog>) => {
    setLogs((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const submitWorkout = async () => {
    const durationMinutes = Math.max(1, elapsedSeconds / 60);
    const overallRpeNum =
      overallRpe.trim() === "" ? null : Number(overallRpe.replace(",", "."));

    if (overallRpeNum !== null && (overallRpeNum < 1 || overallRpeNum > 10)) {
      Alert.alert("Hata", "Genel RPE 1-10 arasi olmali.");
      return;
    }

    const built = buildSessionPayload({
      template,
      logs,
      durationMinutes,
      overallRpe: overallRpeNum,
    });
    if (!built.ok) {
      Alert.alert("Hata", built.message);
      return;
    }

    try {
      await logWorkout.mutateAsync(built.payload);
      if (planEntryId) {
        await setCompletion.mutateAsync({ entryId: planEntryId, completed: true });
      }
      onCompleted?.();
      onClose();
      Alert.alert("Kaydedildi", "Idmanin kaydedildi ve analiz motoruna iletildi.");
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Kayit basarisiz.";
      Alert.alert("Hata", msg);
    }
  };

  const canLog = status === "running" || status === "paused" || status === "finished";
  const editing = editingIndex != null ? logs[editingIndex] : null;
  const editingExercise =
    editingIndex != null ? template.exercises[editingIndex] : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
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
              {completedCount}/{template.exercises.length} egzersiz tamamlandi
            </Text>
          </View>

          <View style={styles.controlRow}>
            {status === "idle" ? (
              <Button label="Baslat" onPress={handleStart} />
            ) : null}
            {status === "running" ? (
              <>
                <Button label="Duraklat" variant="secondary" onPress={handlePause} />
                <Button label="Sonlandir" onPress={handleFinishPress} />
              </>
            ) : null}
            {status === "paused" ? (
              <>
                <Button label="Devam" onPress={handleResume} />
                <Button label="Sonlandir" onPress={handleFinishPress} />
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

          <Text style={styles.sectionLabel}>Egzersizler</Text>
          {template.exercises.map((exercise, index) => {
            const log = logs[index];
            return (
              <Pressable
                key={`${exercise.name}-${index}`}
                disabled={!canLog}
                onPress={() => setEditingIndex(index)}
                style={[
                  styles.exerciseRow,
                  log.completed && styles.exerciseRowDone,
                  !canLog && styles.exerciseRowDisabled,
                ]}
              >
                <View style={[styles.orderBadge, log.completed && styles.orderBadgeDone]}>
                  {log.completed ? (
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
                  {log.completed ? (
                    <Text style={styles.loggedHint}>
                      Kayit: {log.value}
                      {log.measurement === "distance" ? "m" : ""}
                      {log.rpe.trim() ? ` · RPE ${log.rpe}` : ""}
                    </Text>
                  ) : canLog ? (
                    <Text style={styles.tapHint}>Tamamla ve deger gir</Text>
                  ) : null}
                </View>
                <Ionicons
                  name={log.completed ? "create-outline" : "ellipse-outline"}
                  size={20}
                  color={log.completed ? color.accent.primary : color.stroke.strong}
                />
              </Pressable>
            );
          })}

          {showFinishPanel ? (
            <View style={styles.finishPanel}>
              <Text style={styles.sectionLabel}>IDMANI KAYDET</Text>
              <Text style={styles.finishHint}>
                Genel RPE opsiyonel; bos birakirsan 7 kabul edilir.
              </Text>
              <TextInput
                style={styles.rpeInput}
                value={overallRpe}
                onChangeText={setOverallRpe}
                keyboardType="decimal-pad"
                placeholder="Genel RPE (1-10, opsiyonel)"
                placeholderTextColor={color.text.secondary}
              />
              <Button
                label="Kaydet ve Bitir"
                onPress={() => void submitWorkout()}
                loading={logWorkout.isPending || setCompletion.isPending}
              />
            </View>
          ) : null}
        </ScrollView>

        {editing && editingExercise ? (
          <View style={styles.logOverlay}>
            <View style={[styles.logSheet, { paddingBottom: insets.bottom + space.lg }]}>
              <Text style={styles.logTitle}>{editingExercise.name}</Text>
              <Text style={styles.logSubtitle}>
                {exerciseSummary(editingExercise, template.format)}
              </Text>

              <Text style={styles.fieldLabel}>AGIRLIK (KG)</Text>
              <TextInput
                style={styles.fieldInput}
                value={editing.weight}
                onChangeText={(v) => updateLog(editingIndex!, { weight: v })}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={color.text.secondary}
              />

              <Text style={styles.fieldLabel}>{valueLabel(editing.measurement).toUpperCase()}</Text>
              <TextInput
                style={styles.fieldInput}
                value={editing.value}
                onChangeText={(v) => updateLog(editingIndex!, { value: v })}
                keyboardType="decimal-pad"
                placeholder="Deger"
                placeholderTextColor={color.text.secondary}
              />

              <Text style={styles.fieldLabel}>RPE (OPSIYONEL)</Text>
              <TextInput
                style={styles.fieldInput}
                value={editing.rpe}
                onChangeText={(v) => updateLog(editingIndex!, { rpe: v })}
                keyboardType="decimal-pad"
                placeholder="1-10"
                placeholderTextColor={color.text.secondary}
              />

              {!editing.resolvedExerciseId ? (
                <Text style={styles.warnText}>
                  Bu hareket katalogda eslesmedi; kayit sirasinda hata alabilirsin.
                </Text>
              ) : null}

              <View style={styles.logActions}>
                <Button
                  label="Iptal"
                  variant="secondary"
                  onPress={() => setEditingIndex(null)}
                />
                <Button
                  label="Tamamlandi"
                  onPress={() => {
                    updateLog(editingIndex!, { completed: true });
                    setEditingIndex(null);
                  }}
                />
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
  },
  controlRow: {
    gap: space.sm,
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
    gap: space.md,
    marginTop: space.md,
  },
  finishHint: {
    ...type.small,
    color: color.text.secondary,
  },
  rpeInput: {
    backgroundColor: color.bg.elevated,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: color.text.primary,
    ...type.body,
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
  warnText: {
    ...type.small,
    color: color.status.danger,
  },
  logActions: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.md,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
});
