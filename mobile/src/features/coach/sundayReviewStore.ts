/**
 * Pazar Degerlendirme Sihirbazi gecici durum deposu (Zustand).
 */

import { create } from "zustand";

import type { SundayReviewPayload, SundayReviewRecord } from "@/api/types";

export const MISSED_MAX_LENGTH = 2000;
export const RECOVERY_MAX_LENGTH = 1500;

export type SundayReviewAnswers = {
  stepIndex: number;
  missedReason: string;
  nutritionAdherence: number;
  recoveryFeeling: string;
  reviewResult: SundayReviewRecord | null;
};

const INITIAL: SundayReviewAnswers = {
  stepIndex: 0,
  missedReason: "",
  nutritionAdherence: 7,
  recoveryFeeling: "",
  reviewResult: null,
};

type SundayReviewStore = SundayReviewAnswers & {
  set: (partial: Partial<SundayReviewAnswers>) => void;
  reset: () => void;
};

export const useSundayReviewStore = create<SundayReviewStore>((set) => ({
  ...INITIAL,
  set: (partial) => set(partial),
  reset: () => set(INITIAL),
}));

export function isSundayReviewStepValid(
  stepIndex: number,
  answers: SundayReviewAnswers,
): boolean {
  if (stepIndex === 0) {
    const trimmed = answers.missedReason.trim();
    return trimmed.length > 0 && trimmed.length <= MISSED_MAX_LENGTH;
  }
  if (stepIndex === 1) {
    const trimmed = answers.recoveryFeeling.trim();
    return (
      answers.nutritionAdherence >= 1 &&
      answers.nutritionAdherence <= 10 &&
      trimmed.length > 0 &&
      trimmed.length <= RECOVERY_MAX_LENGTH
    );
  }
  if (stepIndex === 2) {
    return answers.reviewResult != null;
  }
  return false;
}

export function buildSundayReviewPayload(
  answers: SundayReviewAnswers,
): SundayReviewPayload | null {
  if (!isSundayReviewStepValid(0, answers) || !isSundayReviewStepValid(1, answers)) {
    return null;
  }
  return {
    missed_workouts_reason: answers.missedReason.trim(),
    nutrition_adherence: answers.nutritionAdherence,
    recovery_feeling: answers.recoveryFeeling.trim(),
  };
}
