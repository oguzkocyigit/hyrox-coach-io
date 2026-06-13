/**
 * Program sekmesi: haftalik antrenman plani (RoxHype "Training" karsiligi).
 * Hafta gezinme, gun kartlari, idman atama/goruntuleme/tamamlama/kaldirma.
 */

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useCreateTemplate,
  useDeleteEntry,
  useScheduleEntry,
  useSetEntryCompletion,
  useUpdateTemplate,
  useWeekPlan,
} from "@/api/hooks";
import type {
  GeneratedDayWorkout,
  ModifiedWorkoutResponse,
  PlanEntry,
  WorkoutTemplate,
} from "@/api/types";
import { normalizeWorkoutTemplate } from "@/features/program/normalizeTemplate";
import {
  estimateDurationMinutes,
  typeMeta,
} from "@/features/program/constants";
import { DayWorkoutAISheet } from "@/features/program/DayWorkoutAISheet";
import { TemplatePickerSheet } from "@/features/program/TemplatePickerSheet";
import { WorkoutBuilderSheet } from "@/features/program/WorkoutBuilderSheet";
import { WorkoutDetailSheet } from "@/features/program/WorkoutDetailSheet";
import { WorkoutLibrarySheet } from "@/features/program/WorkoutLibrarySheet";
import { WorkoutModifyAISheet } from "@/features/program/WorkoutModifyAISheet";
import { WorkoutSessionSheet } from "@/features/program/WorkoutSessionSheet";
import { SundayReviewWizard } from "@/features/coach/SundayReviewWizard";
import { Screen } from "@/ui/Screen";
import { color, radius, space, type } from "@/ui/tokens";

const DAY_LABELS = ["Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi", "Pazar"];
const MONTHS = ["Oca", "Sub", "Mar", "Nis", "May", "Haz", "Tem", "Agu", "Eyl", "Eki", "Kas", "Ara"];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOf(d: Date): Date {
  const result = new Date(d);
  const weekday = (result.getDay() + 6) % 7; // Pzt=0 ... Paz=6
  result.setDate(result.getDate() - weekday);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function shortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function ProgramScreen() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const weekStartIso = toIsoDate(weekStart);

  const { data: plan, isLoading, refetch, isRefetching } = useWeekPlan(weekStartIso);
  const setCompletion = useSetEntryCompletion();
  const deleteEntry = useDeleteEntry();

  // Modal durumlari
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [builderVisible, setBuilderVisible] = useState(false);
  const [builderTemplate, setBuilderTemplate] = useState<WorkoutTemplate | null>(null);
  /** Builder'dan kayit sonrasi otomatik atanacak gun */
  const [pendingScheduleDate, setPendingScheduleDate] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<PlanEntry | null>(null);
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [dayAiVisible, setDayAiVisible] = useState(false);
  const [modifyEntry, setModifyEntry] = useState<PlanEntry | null>(null);
  const [sessionEntry, setSessionEntry] = useState<PlanEntry | null>(null);
  const [sundayReviewVisible, setSundayReviewVisible] = useState(false);

  const scheduleEntry = useScheduleEntry();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const entriesByDate = useMemo(() => {
    const map = new Map<string, PlanEntry[]>();
    for (const entry of plan?.entries ?? []) {
      const list = map.get(entry.scheduled_date) ?? [];
      list.push(entry);
      map.set(entry.scheduled_date, list);
    }
    return map;
  }, [plan]);

  const todayIso = toIsoDate(new Date());
  const currentWeekStartIso = toIsoDate(mondayOf(new Date()));
  const isCurrentWeek = weekStartIso === currentWeekStartIso;
  const isSunday = new Date().getDay() === 0;
  const completedCount = (plan?.entries ?? []).filter((e) => e.completed_at).length;
  const totalCount = plan?.entries.length ?? 0;

  const handleSelectTemplate = async (date: string, template: WorkoutTemplate) => {
    setPickerDate(null);
    const existing = entriesByDate.get(date)?.length ?? 0;
    try {
      await scheduleEntry.mutateAsync({
        template_id: template.template_id,
        scheduled_date: date,
        position: existing,
      });
    } catch (e) {
      Alert.alert("Hata", e instanceof Error ? e.message : "Idman atanamadi.");
    }
  };

  const pickerDayOfWeek = useMemo(() => {
    if (!pickerDate) return 0;
    const d = new Date(`${pickerDate}T12:00:00`);
    return (d.getDay() + 6) % 7;
  }, [pickerDate]);

  const handleDayAiGenerated = async (result: GeneratedDayWorkout) => {
    const date = pickerDate;
    if (!date) return;
    try {
      const saved = await createTemplate.mutateAsync(result.template);
      setDayAiVisible(false);
      setPickerDate(null);
      await handleSelectTemplate(date, saved);
      if (result.focus) {
        Alert.alert("Idman hazir", result.focus);
      }
    } catch (e) {
      Alert.alert("Hata", e instanceof Error ? e.message : "Idman kaydedilemedi.");
    }
  };

  const handleWorkoutModified = async (result: ModifiedWorkoutResponse) => {
    const entry = modifyEntry;
    if (!entry) return;
    try {
      await updateTemplate.mutateAsync({
        templateId: entry.template.template_id,
        payload: result.template,
      });
      setModifyEntry(null);
      const note = result.coach_note || result.focus;
      if (note) {
        Alert.alert("Idman guncellendi", note);
      }
      void refetch();
    } catch (e) {
      Alert.alert("Hata", e instanceof Error ? e.message : "Idman guncellenemedi.");
    }
  };

  const handleRemoveEntry = (entry: PlanEntry) => {
    Alert.alert("Plandan Kaldir", `${entry.template.name} bu gunden kaldirilsin mi?`, [
      { text: "Vazgec", style: "cancel" },
      {
        text: "Kaldir",
        style: "destructive",
        onPress: () => void deleteEntry.mutateAsync(entry.entry_id),
      },
    ]);
  };

  const handleToggleComplete = (entry: PlanEntry) => {
    void setCompletion.mutateAsync({
      entryId: entry.entry_id,
      completed: !entry.completed_at,
    });
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={color.accent.primary}
        />
      }
    >
      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>Program</Text>
        <View style={styles.titleActions}>
          <Pressable
            onPress={() => router.push("/onboarding")}
            style={styles.aiButton}
            accessibilityLabel="AI ile plan olustur"
          >
            <Ionicons name="sparkles" size={15} color={color.accent.ink} />
            <Text style={styles.aiButtonText}>AI Plan</Text>
          </Pressable>
          <Pressable
            onPress={() => setLibraryVisible(true)}
            style={styles.libraryButton}
            accessibilityLabel="Idman kutuphanesi"
          >
            <Ionicons name="barbell-outline" size={16} color={color.text.primary} />
            <Text style={styles.libraryButtonText}>Idmanlarim</Text>
          </Pressable>
        </View>
      </View>

      {/* Hafta gezinme */}
      <View style={styles.weekNav}>
        <Pressable
          onPress={() => setWeekStart((d) => addDays(d, -7))}
          hitSlop={12}
          accessibilityLabel="Onceki hafta"
          style={styles.weekArrow}
        >
          <Ionicons name="chevron-back" size={20} color={color.text.primary} />
        </Pressable>
        <View style={styles.weekCenter}>
          <Text style={styles.weekTitle}>
            {shortDate(weekStart)} - {shortDate(addDays(weekStart, 6))}
          </Text>
          {totalCount > 0 ? (
            <Text style={styles.weekProgress}>
              {completedCount} / {totalCount} idman tamamlandi
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => setWeekStart((d) => addDays(d, 7))}
          hitSlop={12}
          accessibilityLabel="Sonraki hafta"
          style={styles.weekArrow}
        >
          <Ionicons name="chevron-forward" size={20} color={color.text.primary} />
        </Pressable>
      </View>

      {isCurrentWeek ? (
        <Pressable
          onPress={() => setSundayReviewVisible(true)}
          style={({ pressed }) => [
            styles.sundayReviewCard,
            isSunday && styles.sundayReviewCardHighlight,
            pressed && styles.sundayReviewCardPressed,
          ]}
          accessibilityLabel="Pazar degerlendirme sihirbazi"
        >
          <View style={styles.sundayReviewIcon}>
            <Ionicons name="sparkles" size={18} color={color.accent.ink} />
          </View>
          <View style={styles.sundayReviewTexts}>
            <Text style={styles.sundayReviewTitle}>Pazar Degerlendirmesi</Text>
            <Text style={styles.sundayReviewMeta}>
              {totalCount > 0
                ? `${completedCount}/${totalCount} idman · AI haftalik koc ozeti`
                : "Haftalik notlarin ve toparlanman icin AI koc degerlendirmesi"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={color.text.secondary} />
        </Pressable>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={color.accent.primary} style={styles.loading} />
      ) : (
        DAY_LABELS.map((label, dayIndex) => {
          const date = addDays(weekStart, dayIndex);
          const iso = toIsoDate(date);
          const entries = entriesByDate.get(iso) ?? [];
          const isToday = iso === todayIso;

          return (
            <View key={iso} style={styles.dayBlock}>
              <View style={styles.dayHeader}>
                <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                  {label}
                </Text>
                <Text style={styles.dayDate}>{shortDate(date)}</Text>
              </View>

              {entries.map((entry) => {
                const meta = typeMeta(entry.template.workout_type);
                const completed = entry.completed_at != null;
                return (
                  <View
                    key={entry.entry_id}
                    style={[styles.entryCard, completed && styles.entryCardCompleted]}
                  >
                    <View style={styles.entryTop}>
                      <View style={[styles.typeBadge, { borderColor: meta.dot }]}>
                        <View style={[styles.dot, { backgroundColor: meta.dot }]} />
                        <Text style={styles.typeBadgeText}>{meta.label}</Text>
                      </View>
                      <Pressable
                        onPress={() => handleRemoveEntry(entry)}
                        hitSlop={8}
                        accessibilityLabel="Plandan kaldir"
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={color.text.secondary}
                        />
                      </Pressable>
                    </View>

                    <Text style={styles.entryName}>{entry.template.name}</Text>
                    <View style={styles.entryMetaRow}>
                      <Ionicons name="time-outline" size={13} color={color.text.secondary} />
                      <Text style={styles.entryMeta}>
                        ~{estimateDurationMinutes(entry.template)} dk
                      </Text>
                      <Ionicons
                        name="barbell-outline"
                        size={13}
                        color={color.text.secondary}
                      />
                      <Text style={styles.entryMeta}>
                        {entry.template.exercises.length} egzersiz
                      </Text>
                    </View>

                    <View style={styles.entryActions}>
                      <Pressable
                        onPress={() => setDetailEntry(entry)}
                        style={({ pressed }) => [
                          styles.viewButton,
                          pressed && styles.viewButtonPressed,
                        ]}
                      >
                        <Text style={styles.viewButtonText}>Goruntule</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleToggleComplete(entry)}
                        style={[
                          styles.checkButton,
                          completed && styles.checkButtonDone,
                        ]}
                        accessibilityLabel={
                          completed ? "Tamamlandi isaretini kaldir" : "Tamamlandi isaretle"
                        }
                      >
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={completed ? color.accent.ink : color.text.secondary}
                        />
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              <Pressable
                onPress={() => setPickerDate(iso)}
                style={({ pressed }) => [styles.addRow, pressed && styles.addRowPressed]}
              >
                <Ionicons name="add" size={16} color={color.text.secondary} />
                <Text style={styles.addRowText}>Idman Ekle</Text>
              </Pressable>
            </View>
          );
        })
      )}

      {/* Gune idman atama secicisi */}
      <TemplatePickerSheet
        visible={pickerDate != null}
        onClose={() => setPickerDate(null)}
        onSelect={(template) => {
          if (pickerDate) void handleSelectTemplate(pickerDate, template);
        }}
        onCreateNew={() => {
          setPendingScheduleDate(pickerDate);
          setPickerDate(null);
          setBuilderTemplate(null);
          setBuilderVisible(true);
        }}
        onCreateWithAI={() => {
          setDayAiVisible(true);
        }}
      />

      <DayWorkoutAISheet
        visible={dayAiVisible}
        scheduledDate={pickerDate}
        dayOfWeek={pickerDayOfWeek}
        onClose={() => setDayAiVisible(false)}
        onGenerated={(result) => void handleDayAiGenerated(result)}
      />

      {/* Idman kurucu (yeni / duzenleme) */}
      <WorkoutBuilderSheet
        visible={builderVisible}
        template={builderTemplate}
        weekEntries={plan?.entries ?? []}
        scheduledDate={pendingScheduleDate}
        onClose={() => {
          setBuilderVisible(false);
          setPendingScheduleDate(null);
        }}
        onSaved={(saved) => {
          if (pendingScheduleDate) {
            void handleSelectTemplate(pendingScheduleDate, saved);
            setPendingScheduleDate(null);
          }
        }}
      />

      {/* Idman kutuphanesi */}
      <WorkoutLibrarySheet
        visible={libraryVisible}
        onClose={() => setLibraryVisible(false)}
        weekEntries={plan?.entries ?? []}
      />

      {/* Idman detayi */}
      <WorkoutDetailSheet
        visible={detailEntry != null}
        template={
          detailEntry ? normalizeWorkoutTemplate(detailEntry.template) : null
        }
        onClose={() => setDetailEntry(null)}
        onStart={() => {
          if (detailEntry) {
            setSessionEntry(detailEntry);
            setDetailEntry(null);
          }
        }}
        onModifyAI={() => {
          if (detailEntry) {
            setModifyEntry(detailEntry);
            setDetailEntry(null);
          }
        }}
        onEdit={(template) => {
          setDetailEntry(null);
          setBuilderTemplate(template);
          setBuilderVisible(true);
        }}
      />

      <WorkoutModifyAISheet
        visible={modifyEntry != null}
        template={modifyEntry?.template ?? null}
        onClose={() => setModifyEntry(null)}
        onModified={(result) => void handleWorkoutModified(result)}
      />

      <WorkoutSessionSheet
        visible={sessionEntry != null}
        template={
          sessionEntry ? normalizeWorkoutTemplate(sessionEntry.template) : null
        }
        planEntryId={sessionEntry?.entry_id ?? null}
        onClose={() => setSessionEntry(null)}
        onCompleted={() => void refetch()}
      />

      <SundayReviewWizard
        visible={sundayReviewVisible}
        onClose={() => setSundayReviewVisible(false)}
        plannedCount={totalCount}
        completedCount={completedCount}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.lg,
  },
  screenTitle: {
    ...type.heading1,
    color: color.text.primary,
  },
  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs + 2,
    backgroundColor: color.accent.primary,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  aiButtonText: {
    ...type.small,
    fontFamily: "Manrope_600SemiBold",
    color: color.accent.ink,
  },
  libraryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs + 2,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  libraryButtonText: {
    ...type.small,
    color: color.text.primary,
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    marginBottom: space.xl,
  },
  weekArrow: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  weekCenter: {
    alignItems: "center",
    gap: 2,
  },
  weekTitle: {
    ...type.heading2,
    color: color.text.primary,
  },
  weekProgress: {
    ...type.micro,
    color: color.text.secondary,
  },
  sundayReviewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.lg,
  },
  sundayReviewCardHighlight: {
    borderColor: color.accent.primary,
    backgroundColor: color.accent.subtle,
  },
  sundayReviewCardPressed: {
    opacity: 0.85,
  },
  sundayReviewIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: color.accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sundayReviewTexts: {
    flex: 1,
    gap: 2,
  },
  sundayReviewTitle: {
    ...type.bodyStrong,
    color: color.text.primary,
  },
  sundayReviewMeta: {
    ...type.small,
    color: color.text.secondary,
  },
  loading: {
    marginTop: space.huge,
  },
  dayBlock: {
    marginBottom: space.xl,
    gap: space.sm,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  dayName: {
    ...type.heading2,
    color: color.text.primary,
  },
  dayNameToday: {
    color: color.accent.primary,
  },
  dayDate: {
    ...type.small,
    color: color.text.secondary,
  },
  entryCard: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  entryCardCompleted: {
    borderColor: color.status.safe,
    opacity: 0.75,
  },
  entryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  entryName: {
    ...type.bodyStrong,
    color: color.text.primary,
    fontSize: 17,
  },
  entryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  entryMeta: {
    ...type.small,
    color: color.text.secondary,
    marginRight: space.sm,
  },
  entryActions: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.xs,
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
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderStyle: "dashed",
    borderRadius: radius.md,
    paddingVertical: space.md,
  },
  addRowPressed: {
    backgroundColor: color.bg.surface,
  },
  addRowText: {
    ...type.small,
    color: color.text.secondary,
  },
});
