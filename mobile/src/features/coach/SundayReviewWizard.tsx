/**
 * Pazar Degerlendirme Sihirbazi — Typeform tarzi 3 adimli akis.
 * 1) Plan uyumu  2) Beslenme & toparlanma  3) AI koc degerlendirmesi
 */

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { useMe, useSundayReview } from "@/api/hooks";
import { ReviewSummaryCard } from "@/features/coach/ReviewSummaryCard";
import {
  buildSundayReviewPayload,
  isSundayReviewStepValid,
  MISSED_MAX_LENGTH,
  RECOVERY_MAX_LENGTH,
  useSundayReviewStore,
} from "@/features/coach/sundayReviewStore";
import { Slider } from "@/features/onboarding/Slider";
import { Button } from "@/ui/Button";
import { color, font, radius, space, type } from "@/ui/tokens";

const MISSED_REASON_PRESETS = [
  { id: "completed", label: "Tum idmanlari tamamladim", text: "Tum planlanan idmanlari tamamladim." },
  { id: "work", label: "Is / yogunluk", text: "Is ve gunluk yogunluk nedeniyle bazi idmanlari kacirdim." },
  { id: "injury", label: "Sakatlik / agrı", text: "Sakatlik veya agrı nedeniyle bazi idmanlari kacirdim." },
  { id: "motivation", label: "Motivasyon", text: "Motivasyon dusuklugu nedeniyle bazi idmanlari kacirdim." },
] as const;

const RECOVERY_PRESETS = [
  "Taze ve enerjik hissediyorum",
  "Genel olarak iyi toparlandim",
  "Biraz yorgunum ama idman yapabilirim",
  "CNS yorgun — dinlenmeye ihtiyacim var",
] as const;

type SundayReviewWizardProps = {
  visible: boolean;
  onClose: () => void;
  plannedCount: number;
  completedCount: number;
};

export function SundayReviewWizard({
  visible,
  onClose,
  plannedCount,
  completedCount,
}: SundayReviewWizardProps) {
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const sundayReview = useSundayReview();
  const store = useSundayReviewStore();
  const {
    stepIndex,
    missedReason,
    nutritionAdherence,
    recoveryFeeling,
    reviewResult,
    set: setStore,
    reset: resetStore,
  } = store;

  const [missedFocused, setMissedFocused] = useState(false);
  const [recoveryFocused, setRecoveryFocused] = useState(false);

  const missedCount = Math.max(0, plannedCount - completedCount);

  const steps = useMemo(
    () => [
      {
        title: "Bu hafta ne kadar uyumluydun?",
        subtitle:
          plannedCount > 0
            ? `Planlanan ${plannedCount} idmandan ${completedCount} tanesini tamamladin.`
            : "Bu hafta planlanmis idman bulunmuyor; yine de haftani degerlendirelim.",
        valid: isSundayReviewStepValid(0, store),
      },
      {
        title: "Beslenme ve toparlanma",
        subtitle: "OMAD / protein hedefin ve vucudunun sinyalleri haftaya yon verir.",
        valid: isSundayReviewStepValid(1, store),
      },
      {
        title: reviewResult ? "Kocun haftalik degerlendirmesi" : "AI koc analiz ediyor",
        subtitle: reviewResult
          ? "Gelecek hafta icin taktiksel oneriler asagida."
          : "Idman notlarin, RPE ve metriklerin inceleniyor...",
        valid: isSundayReviewStepValid(2, store),
      },
    ],
    [plannedCount, completedCount, missedReason, nutritionAdherence, recoveryFeeling, reviewResult],
  );

  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const resetState = () => {
    resetStore();
    sundayReview.reset();
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const submitReview = () => {
    const payload = buildSundayReviewPayload(store);
    if (!payload) return;

    sundayReview.mutate(payload, {
      onSuccess: (response) => {
        setStore({ reviewResult: response });
      },
    });
  };

  const handleNext = () => {
    if (stepIndex === 1) {
      setStore({ stepIndex: 2 });
      submitReview();
      return;
    }
    if (!isLastStep) {
      setStore({ stepIndex: stepIndex + 1 });
    }
  };

  const errorMessage =
    sundayReview.isError && sundayReview.error instanceof ApiError
      ? sundayReview.error.message
      : sundayReview.isError
        ? "Degerlendirme alinamadi. Tekrar dene."
        : null;

  if (!visible) return null;

  if (me?.tier === "free") {
    return (
      <Modal visible animationType="slide" onRequestClose={handleClose}>
        <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
          <View style={styles.header}>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={color.text.primary} />
            </Pressable>
          </View>
          <View style={[styles.center, { paddingBottom: insets.bottom + space.xxl }]}>
            <Ionicons name="lock-closed" size={32} color={color.accent.primary} />
            <Text style={styles.title}>Pazar Degerlendirmesi</Text>
            <Text style={styles.subtitle}>
              Haftalik idman notlarini, beslenme uyumunu ve toparlanmayi AI koc
              ile degerlendirmek icin Premium veya Pro gerekir.
            </Text>
            <Button label="Premium'a Gec" onPress={() => router.push("/paywall")} />
            <Button label="Kapat" variant="ghost" onPress={handleClose} />
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
        <View style={styles.header}>
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
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.stepCounter}>
            ADIM {stepIndex + 1} / {steps.length}
          </Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.subtitle}>{step.subtitle}</Text>

          {stepIndex === 0 ? (
            <View style={styles.stepBody}>
              {missedCount > 0 ? (
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{missedCount}</Text>
                  <Text style={styles.statLabel}>KACIRILAN IDMAN</Text>
                </View>
              ) : (
                <View style={[styles.statCard, styles.statCardSuccess]}>
                  <Ionicons name="checkmark-circle" size={28} color={color.status.safe} />
                  <Text style={styles.statSuccessText}>Haftalik plana tam uyum</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>DURUM NEYDİ?</Text>
              <View style={styles.presetRow}>
                {MISSED_REASON_PRESETS.map((preset) => {
                  const active = missedReason === preset.text;
                  return (
                    <Pressable
                      key={preset.id}
                      onPress={() => setStore({ missedReason: preset.text })}
                      style={[styles.presetPill, active && styles.presetPillActive]}
                    >
                      <Text style={[styles.presetText, active && styles.presetTextActive]}>
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                style={[styles.textArea, missedFocused && styles.textAreaFocused]}
                value={missedReason}
                onChangeText={(text) => setStore({ missedReason: text })}
                onFocus={() => setMissedFocused(true)}
                onBlur={() => setMissedFocused(false)}
                multiline
                maxLength={MISSED_MAX_LENGTH}
                textAlignVertical="top"
                placeholder={
                  missedCount > 0
                    ? "Kacirdigin idmanlarin nedenini anlat..."
                    : "Eklemek istedigin bir not varsa yaz..."
                }
                placeholderTextColor={color.text.disabled}
              />
            </View>
          ) : null}

          {stepIndex === 1 ? (
            <View style={styles.stepBody}>
              <View style={styles.sliderCard}>
                <Text style={styles.fieldLabel}>BESLENME UYUMU (1-10)</Text>
                <Text style={styles.sliderHint}>
                  190g protein / OMAD hedefine ne kadar uyabildin?
                </Text>
                <Slider
                  min={1}
                  max={10}
                  value={nutritionAdherence}
                  onChange={(value) => setStore({ nutritionAdherence: value })}
                  formatValue={(v) => `${v} / 10`}
                  minLabel="Dusuk uyum"
                  maxLabel="Mukemmel uyum"
                />
              </View>

              <Text style={styles.fieldLabel}>GENEL TOPARLANMA HISSIYATI</Text>
              <View style={styles.presetCol}>
                {RECOVERY_PRESETS.map((preset) => {
                  const active = recoveryFeeling === preset;
                  return (
                    <Pressable
                      key={preset}
                      onPress={() => setStore({ recoveryFeeling: preset })}
                      style={[styles.recoveryRow, active && styles.recoveryRowActive]}
                    >
                      <Text style={[styles.recoveryText, active && styles.recoveryTextActive]}>
                        {preset}
                      </Text>
                      {active ? (
                        <Ionicons name="checkmark" size={16} color={color.accent.ink} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                style={[styles.textArea, recoveryFocused && styles.textAreaFocused]}
                value={recoveryFeeling}
                onChangeText={(text) => setStore({ recoveryFeeling: text })}
                onFocus={() => setRecoveryFocused(true)}
                onBlur={() => setRecoveryFocused(false)}
                multiline
                maxLength={RECOVERY_MAX_LENGTH}
                textAlignVertical="top"
                placeholder="Enerji, uyku, eklem agrisi, OMAD etkisi..."
                placeholderTextColor={color.text.disabled}
              />
            </View>
          ) : null}

          {stepIndex === 2 ? (
            <View style={styles.stepBody}>
              {sundayReview.isPending && !reviewResult ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={color.accent.primary} />
                  <Text style={styles.loadingText}>
                    Idman gunlugun ve haftalik metriklerin analiz ediliyor...
                  </Text>
                </View>
              ) : null}

              {reviewResult ? <ReviewSummaryCard review={reviewResult} /> : null}
            </View>
          ) : null}

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={color.status.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            {stepIndex > 0 && stepIndex < 2 && !sundayReview.isPending ? (
              <Button
                label="Geri"
                variant="secondary"
                onPress={() => setStore({ stepIndex: stepIndex - 1 })}
              />
            ) : null}

            {isLastStep && reviewResult ? (
              <Button label="Tamam" onPress={handleClose} />
            ) : !isLastStep ? (
              <Button
                label={stepIndex === 1 ? "Degerlendirmeyi Al" : "Devam"}
                onPress={handleNext}
                disabled={!step.valid || sundayReview.isPending}
                loading={stepIndex === 1 && sundayReview.isPending}
              />
            ) : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg.base,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.xl,
    marginBottom: space.lg,
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
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: color.bg.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  stepCounter: {
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
  },
  stepBody: {
    gap: space.md,
  },
  statCard: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    alignItems: "center",
    gap: space.xs,
  },
  statCardSuccess: {
    borderColor: color.status.safe,
    backgroundColor: "rgba(43, 217, 168, 0.08)",
  },
  statValue: {
    fontFamily: font.display.bold,
    fontSize: 44,
    color: color.status.caution,
  },
  statLabel: {
    ...type.micro,
    color: color.text.secondary,
  },
  statSuccessText: {
    ...type.bodyStrong,
    color: color.status.safe,
  },
  fieldLabel: {
    ...type.micro,
    color: color.text.secondary,
    marginTop: space.sm,
  },
  sliderHint: {
    ...type.small,
    color: color.text.secondary,
    marginBottom: space.sm,
  },
  sliderCard: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  presetPill: {
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: color.bg.elevated,
  },
  presetPillActive: {
    backgroundColor: color.accent.primary,
    borderColor: color.accent.primary,
  },
  presetText: {
    ...type.small,
    color: color.text.secondary,
  },
  presetTextActive: {
    color: color.accent.ink,
    fontFamily: font.body.semibold,
  },
  presetCol: {
    gap: space.sm,
  },
  recoveryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    minHeight: 52,
  },
  recoveryRowActive: {
    borderColor: color.accent.primary,
    backgroundColor: color.accent.subtle,
  },
  recoveryText: {
    ...type.body,
    color: color.text.primary,
    flex: 1,
  },
  recoveryTextActive: {
    fontFamily: font.body.semibold,
  },
  textArea: {
    minHeight: 120,
    backgroundColor: color.bg.elevated,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: color.text.primary,
    ...type.body,
  },
  textAreaFocused: {
    borderColor: color.accent.primary,
  },
  loadingBox: {
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.xxl,
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
  footer: {
    marginTop: space.lg,
    gap: space.sm,
  },
});
