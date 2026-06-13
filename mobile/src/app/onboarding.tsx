/**
 * AI Onboarding Wizard (modal): Typeform tarzi adim adim akis.
 * Cevaplar useOnboardingStore'da (Zustand) tutulur; son adimda
 * POST /plan/generate cagrilir ve uretilen haftalik plan onizlenir.
 * "Programa Ekle" mevcut /templates + /plan/entries uclarini kullanir.
 */

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import { useCreateTemplate, useGeneratePlan, useScheduleEntry } from "@/api/hooks";
import type { GeneratedDay, GeneratedWeekPlan, WorkoutTemplate, WorkoutTemplateCreate } from "@/api/types";
import { OptionCard } from "@/features/onboarding/OptionCard";
import { DayPicker } from "@/features/onboarding/DayPicker";
import { SessionScheduleCard } from "@/features/onboarding/SessionScheduleCard";
import { Slider } from "@/features/onboarding/Slider";
import {
  EQUIPMENT_OPTIONS,
  FED_STATE_OPTIONS,
  GOAL_OPTIONS,
  NUTRITION_OPTIONS,
  OLYMPIC_OPTIONS,
  SLED_OPTIONS,
  SPLIT_SESSION_OPTIONS,
  WEEKEND_OPTIONS,
  ZONE2_OPTIONS,
  formatPace,
} from "@/features/onboarding/options";
import { buildPayload, hasOverlappingDays, useOnboardingStore } from "@/features/onboarding/store";
import {
  estimateDurationMinutes,
  exerciseSummary,
  typeMeta,
} from "@/features/program/constants";
import { normalizeWorkoutTemplate } from "@/features/program/normalizeTemplate";
import { WorkoutDetailSheet } from "@/features/program/WorkoutDetailSheet";
import { Button } from "@/ui/Button";
import { color, font, radius, space, type } from "@/ui/tokens";

const DAY_LABELS = ["Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi", "Pazar"];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOf(d: Date): Date {
  const result = new Date(d);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Onizleme detay modali icin gecici sablon (henuz DB'de yok). */
function asPreviewTemplate(
  template: WorkoutTemplateCreate,
  dayOfWeek: number,
): WorkoutTemplate {
  const now = new Date().toISOString();
  return normalizeWorkoutTemplate({
    ...template,
    template_id: `preview-${dayOfWeek}`,
    created_at: now,
    updated_at: now,
  });
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const store = useOnboardingStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [applying, setApplying] = useState(false);
  const [previewDay, setPreviewDay] = useState<GeneratedDay | null>(null);

  const generate = useGeneratePlan();
  const createTemplate = useCreateTemplate();
  const scheduleEntry = useScheduleEntry();

  const steps = [
    {
      title: "Hedefin ne?",
      subtitle: "Program agirligi bu secime gore kurulur.",
      valid: store.goal != null,
      content: (
        <View style={styles.options}>
          {GOAL_OPTIONS.map((o) => (
            <OptionCard
              key={o.value}
              {...o}
              selected={store.goal === o.value}
              onPress={() => store.set({ goal: o.value })}
            />
          ))}
        </View>
      ),
    },
    {
      title: "Kardiyo kapasiten",
      subtitle: "5K temponu ve Zone 2 aliskanligini bilelim.",
      valid: store.zone2Habit != null,
      content: (
        <View style={styles.options}>
          <View style={styles.sliderCard}>
            <Text style={styles.sliderTitle}>5K TEMPON (ORTALAMA)</Text>
            <Slider
              min={240}
              max={540}
              step={5}
              value={store.paceSecondsPerKm}
              onChange={(v) => store.set({ paceSecondsPerKm: v })}
              formatValue={formatPace}
              minLabel="4:00 hizli"
              maxLabel="9:00 rahat"
            />
          </View>
          <Text style={styles.groupLabel}>ZONE 2 ALISKANLIGI</Text>
          {ZONE2_OPTIONS.map((o) => (
            <OptionCard
              key={o.value}
              {...o}
              selected={store.zone2Habit === o.value}
              onPress={() => store.set({ zone2Habit: o.value })}
            />
          ))}
        </View>
      ),
    },
    {
      title: "Hareket kapasiten",
      subtitle: "Teknik gerektiren hareketlerde seviyeni secelim.",
      valid: store.sledExperience != null && store.olympicProficiency != null,
      content: (
        <View style={styles.options}>
          <Text style={styles.groupLabel}>SLED PUSH / PULL TECRUBESI</Text>
          {SLED_OPTIONS.map((o) => (
            <OptionCard
              key={o.value}
              {...o}
              selected={store.sledExperience === o.value}
              onPress={() => store.set({ sledExperience: o.value })}
            />
          ))}
          <Text style={styles.groupLabel}>OLIMPIK KALDIRISLAR</Text>
          {OLYMPIC_OPTIONS.map((o) => (
            <OptionCard
              key={o.value}
              {...o}
              selected={store.olympicProficiency === o.value}
              onPress={() => store.set({ olympicProficiency: o.value })}
            />
          ))}
        </View>
      ),
    },
    {
      title: "Haftalik takvim",
      subtitle: "Salon idmanlarini ve kosu gunlerini sec.",
      valid:
        store.trainingDays.length >= 2 &&
        (!store.wantsRunning || store.runningDays.length >= 1),
      content: (
        <View style={styles.options}>
          <DayPicker
            label="SALON / IDMAN GUNLERI"
            selected={store.trainingDays}
            onChange={(days) => store.set({ trainingDays: days })}
          />
          <Text style={styles.groupLabel}>KOSU EKLEMEK ISTIYOR MUSUN?</Text>
          {[
            { value: true, label: "Evet", description: "Haftaya kosu gunleri ekle", icon: "footsteps-outline" as const },
            { value: false, label: "Hayir", description: "Sadece salon / kuvvet odakli", icon: "barbell-outline" as const },
          ].map((o) => (
            <OptionCard
              key={String(o.value)}
              {...o}
              selected={store.wantsRunning === o.value}
              onPress={() =>
                store.set({
                  wantsRunning: o.value,
                  runningDays: o.value ? store.runningDays : [],
                })
              }
            />
          ))}
          {store.wantsRunning ? (
            <DayPicker
              label="KOSU GUNLERI"
              selected={store.runningDays}
              onChange={(days) => store.set({ runningDays: days })}
            />
          ) : null}
        </View>
      ),
    },
    {
      title: "Zamanlama",
      subtitle: "Salon ve kosu icin tercih ettigin saat araligi ve sure.",
      valid:
        store.gymEndMinutes > store.gymStartMinutes &&
        (!hasOverlappingDays(store) || store.splitRunAndGym != null) &&
        (!store.wantsRunning || store.runEndMinutes > store.runStartMinutes),
      content: (
        <View style={styles.options}>
          {hasOverlappingDays(store) ? (
            <>
              <Text style={styles.groupLabel}>
                AYNI GUNDE KOSU + SALON NASIL OLSUN?
              </Text>
              {SPLIT_SESSION_OPTIONS.map((o) => (
                <OptionCard
                  key={String(o.value)}
                  {...o}
                  selected={store.splitRunAndGym === o.value}
                  onPress={() => store.set({ splitRunAndGym: o.value })}
                />
              ))}
            </>
          ) : null}
          <SessionScheduleCard
            title="Salon idmani"
            icon="barbell-outline"
            startMinutes={store.gymStartMinutes}
            endMinutes={store.gymEndMinutes}
            durationMinutes={store.gymDurationMinutes}
            durationMin={30}
            durationMax={120}
            onStartChange={(gymStartMinutes) =>
              store.set({
                gymStartMinutes,
                gymEndMinutes: Math.max(gymStartMinutes + 30, store.gymEndMinutes),
              })
            }
            onEndChange={(gymEndMinutes) => store.set({ gymEndMinutes })}
            onDurationChange={(gymDurationMinutes) => store.set({ gymDurationMinutes })}
          />
          {store.wantsRunning ? (
            <SessionScheduleCard
              title="Kosu"
              icon="footsteps-outline"
              startMinutes={store.runStartMinutes}
              endMinutes={store.runEndMinutes}
              durationMinutes={store.runDurationMinutes}
              durationMin={20}
              durationMax={90}
              onStartChange={(runStartMinutes) =>
                store.set({
                  runStartMinutes,
                  runEndMinutes: Math.max(runStartMinutes + 30, store.runEndMinutes),
                })
              }
              onEndChange={(runEndMinutes) => store.set({ runEndMinutes })}
              onDurationChange={(runDurationMinutes) => store.set({ runDurationMinutes })}
            />
          ) : null}
        </View>
      ),
    },
    {
      title: "Beslenme tercihleri",
      subtitle: "Idmandan once yemek yiyip yemedigini belirt.",
      valid:
        store.gymFedState != null &&
        (!store.wantsRunning || store.runFedState != null),
      content: (
        <View style={styles.options}>
          <Text style={styles.groupLabel}>SALON — IDMAN ONCESI</Text>
          {FED_STATE_OPTIONS.map((o) => (
            <OptionCard
              key={`gym-fed-${o.value}`}
              {...o}
              selected={store.gymFedState === o.value}
              onPress={() => store.set({ gymFedState: o.value })}
            />
          ))}
          {store.wantsRunning ? (
            <>
              <Text style={styles.groupLabel}>KOSU — IDMAN ONCESI</Text>
              {FED_STATE_OPTIONS.map((o) => (
                <OptionCard
                  key={`run-fed-${o.value}`}
                  {...o}
                  selected={store.runFedState === o.value}
                  onPress={() => store.set({ runFedState: o.value })}
                />
              ))}
            </>
          ) : null}
        </View>
      ),
    },
    {
      title: "Takvim ve toparlanma",
      subtitle: "Programi yasam duzenine gore sekillendirelim.",
      valid: store.weekendConditioning != null && store.nutritionConstraint != null,
      content: (
        <View style={styles.options}>
          <Text style={styles.groupLabel}>AGIR KONDISYON GUNLERI</Text>
          {WEEKEND_OPTIONS.map((o) => (
            <OptionCard
              key={String(o.value)}
              {...o}
              selected={store.weekendConditioning === o.value}
              onPress={() => store.set({ weekendConditioning: o.value })}
            />
          ))}
          <Text style={styles.groupLabel}>BESLENME KISITI</Text>
          {NUTRITION_OPTIONS.map((o) => (
            <OptionCard
              key={o.value}
              {...o}
              selected={store.nutritionConstraint === o.value}
              onPress={() => store.set({ nutritionConstraint: o.value })}
            />
          ))}
        </View>
      ),
    },
    {
      title: "Ekipman",
      subtitle: "Erisimin olan ekipmani sec.",
      valid: store.equipment != null,
      content: (
        <View style={styles.options}>
          {EQUIPMENT_OPTIONS.map((o) => (
            <OptionCard
              key={o.value}
              {...o}
              selected={store.equipment === o.value}
              onPress={() => store.set({ equipment: o.value })}
            />
          ))}
        </View>
      ),
    },
    {
      title: "Ozel isteklerin var mi?",
      subtitle: "Gun bazli veya genel program tercihlerini yaz. Bos birakabilirsin.",
      valid: store.customProgramNotes.length <= 1500,
      content: (
        <View style={styles.options}>
          <View style={styles.notesCard}>
            <Text style={styles.notesHint}>Ornek istekler:</Text>
            <Text style={styles.notesExample}>
              • 5 salon idmanindan 2'si upper hipertrofi, 2'si CrossFit full body
              metcon, 1'i Cumartesi HYROX simulate{"\n"}
              • Carsamba sadece teknik calisma, agirlik yok{"\n"}
              • Pazartesi ve Persembe sled istasyonu olsun
            </Text>
            <TextInput
              style={styles.notesInput}
              value={store.customProgramNotes}
              onChangeText={(text) => store.set({ customProgramNotes: text })}
              placeholder="Isteklerini buraya yaz..."
              placeholderTextColor={color.text.disabled}
              multiline
              textAlignVertical="top"
              maxLength={1500}
            />
            <Text style={styles.notesCounter}>
              {store.customProgramNotes.length}/1500
            </Text>
          </View>
        </View>
      ),
    },
  ];

  const isLastStep = stepIndex === steps.length - 1;
  const step = steps[stepIndex];

  const handleClose = () => {
    store.reset();
    generate.reset();
    router.back();
  };

  const handleGenerate = () => {
    const payload = buildPayload(store);
    if (!payload) return;
    generate.reset();
    generate.mutate(payload);
  };

  /** Uretilen plani sablon + plan girisi olarak kaydeder. */
  const applyPlan = async (plan: GeneratedWeekPlan, weekOffset: 0 | 1) => {
    setApplying(true);
    try {
      const monday = mondayOf(new Date());
      monday.setDate(monday.getDate() + weekOffset * 7);
      for (const day of plan.days) {
        const saved = await createTemplate.mutateAsync(day.template);
        const date = new Date(monday);
        date.setDate(date.getDate() + day.day_of_week);
        await scheduleEntry.mutateAsync({
          template_id: saved.template_id,
          scheduled_date: toIsoDate(date),
          position: 0,
        });
      }
      store.reset();
      generate.reset();
      router.back();
      Alert.alert(
        "Plan Hazir",
        "Haftalik programin olusturuldu. Program sekmesinden takip edebilirsin.",
      );
    } catch (e) {
      Alert.alert("Hata", e instanceof Error ? e.message : "Plan kaydedilemedi.");
    } finally {
      setApplying(false);
    }
  };

  // ---------------- Uretim surecinde ----------------
  if (generate.isPending) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={color.accent.primary} />
        <Text style={styles.loadingTitle}>Plan hazirlaniyor</Text>
        <Text style={styles.loadingText}>
          AI koc; hedefini, ozel isteklerini ve ekipmanini degerlendiriyor...
        </Text>
      </View>
    );
  }

  // ---------------- Sonuc onizleme ----------------
  if (generate.data) {
    const plan = generate.data;
    return (
      <View style={[styles.root, { paddingTop: insets.top + space.lg }]}>
        <View style={styles.header}>
          <View style={styles.headerTexts}>
            <Text style={styles.brand}>AI KOC PLANI</Text>
            <Text style={styles.title}>Haftalik Programin</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={12} style={styles.closeButton}>
            <Ionicons name="close" size={22} color={color.text.primary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + space.xxl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryBox}>
            <Ionicons name="sparkles" size={16} color={color.accent.primary} />
            <Text style={styles.summaryText}>{plan.coach_summary}</Text>
          </View>

          {[...plan.days]
            .sort((a, b) => a.day_of_week - b.day_of_week)
            .map((day) => {
              const meta = typeMeta(day.template.workout_type);
              return (
                <Pressable
                  key={day.day_of_week}
                  onPress={() => setPreviewDay(day)}
                  style={({ pressed }) => [styles.dayCard, pressed && styles.dayCardPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${DAY_LABELS[day.day_of_week]} idman detayi`}
                >
                  <View style={styles.dayCardHeader}>
                    <Text style={styles.dayCardDay}>
                      {DAY_LABELS[day.day_of_week] ?? `Gun ${day.day_of_week + 1}`}
                    </Text>
                    <View style={styles.dayCardHeaderRight}>
                      <View style={[styles.typeBadge, { borderColor: meta.dot }]}>
                        <View style={[styles.dot, { backgroundColor: meta.dot }]} />
                        <Text style={styles.typeBadgeText}>{meta.label}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={color.text.secondary} />
                    </View>
                  </View>
                  <Text style={styles.dayCardName}>{day.template.name}</Text>
                  <Text style={styles.dayCardFocus}>{day.focus}</Text>
                  <Text style={styles.dayCardMeta}>
                    ~{estimateDurationMinutes(day.template)} dk ·{" "}
                    {day.template.exercises.length} egzersiz · Detay icin dokun
                  </Text>
                  <View style={styles.exerciseList}>
                    {day.template.exercises.slice(0, 3).map((e, i) => (
                      <Text key={i} style={styles.exerciseLine} numberOfLines={1}>
                        {i + 1}. {e.name} — {exerciseSummary(e, day.template.format)}
                      </Text>
                    ))}
                    {day.template.exercises.length > 3 ? (
                      <Text style={styles.exerciseMore}>
                        +{day.template.exercises.length - 3} egzersiz daha
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}

          <WorkoutDetailSheet
            visible={previewDay != null}
            template={
              previewDay ? asPreviewTemplate(previewDay.template, previewDay.day_of_week) : null
            }
            focus={previewDay?.focus}
            onClose={() => setPreviewDay(null)}
          />

          <Button
            label="Bu Haftaya Ekle"
            onPress={() => void applyPlan(plan, 0)}
            loading={applying}
          />
          <Button
            label="Gelecek Haftaya Ekle"
            variant="secondary"
            onPress={() => void applyPlan(plan, 1)}
            disabled={applying}
          />
          <Button
            label="Begenmedim, Yeniden Olustur"
            variant="ghost"
            onPress={handleGenerate}
            disabled={applying}
          />
        </ScrollView>
      </View>
    );
  }

  // ---------------- Sihirbaz adimlari ----------------
  return (
    <View style={[styles.root, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.header}>
        {stepIndex > 0 ? (
          <Pressable
            onPress={() => setStepIndex((i) => i - 1)}
            hitSlop={12}
            style={styles.closeButton}
          >
            <Ionicons name="arrow-back" size={20} color={color.text.primary} />
          </Pressable>
        ) : (
          <View style={styles.closeButton} />
        )}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${((stepIndex + 1) / steps.length) * 100}%` },
            ]}
          />
        </View>
        <Pressable onPress={handleClose} hitSlop={12} style={styles.closeButton}>
          <Ionicons name="close" size={22} color={color.text.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + space.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepCounter}>
          ADIM {stepIndex + 1} / {steps.length}
        </Text>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{step.subtitle}</Text>

        {step.content}

        {generate.isError ? (
          <View style={styles.errorBox}>
            <Ionicons
              name={
                generate.error instanceof ApiError && generate.error.status === 429
                  ? "time-outline"
                  : "alert-circle-outline"
              }
              size={16}
              color={
                generate.error instanceof ApiError && generate.error.status === 429
                  ? color.text.secondary
                  : color.status.danger
              }
            />
            <Text
              style={[
                styles.errorText,
                generate.error instanceof ApiError &&
                  generate.error.status === 429 &&
                  styles.errorTextCalm,
              ]}
            >
              {generate.error instanceof ApiError
                ? generate.error.message
                : "Plan olusturulamadi. Tekrar dene."}
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Button
            label={isLastStep ? "Plani Olustur" : "Devam"}
            onPress={() => {
              if (isLastStep) handleGenerate();
              else setStepIndex((i) => i + 1);
            }}
            disabled={!step.valid}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg.base,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: space.xxl,
    gap: space.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.xl,
    marginBottom: space.lg,
  },
  headerTexts: {
    flex: 1,
    gap: space.xs,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: color.bg.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: color.bg.elevated,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: color.accent.primary,
  },
  content: {
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  stepCounter: {
    ...type.micro,
    color: color.accent.primary,
  },
  brand: {
    ...type.micro,
    color: color.accent.primary,
  },
  title: {
    ...type.displayLg,
    color: color.text.primary,
  },
  subtitle: {
    ...type.body,
    color: color.text.secondary,
    marginBottom: space.sm,
  },
  options: {
    gap: space.md,
  },
  groupLabel: {
    ...type.micro,
    color: color.text.secondary,
    marginTop: space.sm,
  },
  sliderCard: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  sliderTitle: {
    ...type.micro,
    color: color.text.secondary,
  },
  footer: {
    marginTop: space.lg,
  },
  loadingTitle: {
    ...type.heading1,
    color: color.text.primary,
    marginTop: space.lg,
  },
  loadingText: {
    ...type.body,
    color: color.text.secondary,
    textAlign: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    backgroundColor: color.status.dangerSubtle,
    borderWidth: 1,
    borderColor: color.status.danger,
    borderRadius: radius.md,
    padding: space.md,
  },
  errorText: {
    ...type.small,
    color: color.status.danger,
    flex: 1,
  },
  errorTextCalm: {
    color: color.text.secondary,
  },
  summaryBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.accent.primary,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  summaryText: {
    ...type.body,
    color: color.text.primary,
    flex: 1,
    lineHeight: 22,
  },
  dayCard: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
  },
  dayCardPressed: {
    borderColor: color.accent.primary,
    backgroundColor: color.accent.subtle,
  },
  dayCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayCardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  dayCardDay: {
    ...type.micro,
    color: color.text.secondary,
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
  dayCardName: {
    fontFamily: font.body.semibold,
    fontSize: 17,
    color: color.text.primary,
  },
  dayCardFocus: {
    ...type.small,
    color: color.text.secondary,
    fontStyle: "italic",
  },
  dayCardMeta: {
    ...type.small,
    color: color.text.secondary,
  },
  exerciseList: {
    marginTop: space.sm,
    gap: 4,
  },
  exerciseLine: {
    ...type.small,
    color: color.text.primary,
  },
  exerciseMore: {
    ...type.small,
    color: color.text.secondary,
    fontStyle: "italic",
    marginLeft: space.sm,
  },
  notesCard: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  notesHint: {
    ...type.micro,
    color: color.text.secondary,
  },
  notesExample: {
    ...type.small,
    color: color.text.secondary,
    lineHeight: 20,
  },
  notesInput: {
    minHeight: 140,
    backgroundColor: color.bg.elevated,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: color.text.primary,
    ...type.body,
    marginTop: space.sm,
  },
  notesCounter: {
    ...type.micro,
    color: color.text.secondary,
    textAlign: "right",
  },
});
