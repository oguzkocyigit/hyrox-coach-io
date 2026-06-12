/**
 * AI Onboarding Wizard gecici durum deposu (Zustand).
 * Sihirbaz adimlari arasinda cevaplari tutar; backend'e gonderilecek
 * OnboardingPayload bu durumdan turetilir. Kalici degildir (persist yok):
 * sihirbaz tamamlaninca veya iptal edilince reset edilir.
 */

import { create } from "zustand";

import type {
  EquipmentLevel,
  NutritionConstraint,
  OlympicProficiency,
  OnboardingPayload,
  SledExperience,
  TrainingGoal,
  Zone2Habit,
} from "@/api/types";

export type OnboardingAnswers = {
  goal: TrainingGoal | null;
  /** 5K temposu, sn/km (orn. 330 = 5:30/km) */
  paceSecondsPerKm: number;
  zone2Habit: Zone2Habit | null;
  sledExperience: SledExperience | null;
  olympicProficiency: OlympicProficiency | null;
  /** Agir kondisyon gunleri hafta sonuna alinsin mi */
  weekendConditioning: boolean | null;
  nutritionConstraint: NutritionConstraint | null;
  equipment: EquipmentLevel | null;
  daysPerWeek: number;
};

const INITIAL: OnboardingAnswers = {
  goal: null,
  paceSecondsPerKm: 330,
  zone2Habit: null,
  sledExperience: null,
  olympicProficiency: null,
  weekendConditioning: null,
  nutritionConstraint: null,
  equipment: null,
  daysPerWeek: 4,
};

type OnboardingStore = OnboardingAnswers & {
  set: (partial: Partial<OnboardingAnswers>) => void;
  reset: () => void;
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  ...INITIAL,
  set: (partial) => set(partial),
  reset: () => set(INITIAL),
}));

/** Store durumunu backend payload'una cevirir (tum adimlar dolu olmali). */
export function buildPayload(s: OnboardingAnswers): OnboardingPayload | null {
  if (
    s.goal == null ||
    s.zone2Habit == null ||
    s.sledExperience == null ||
    s.olympicProficiency == null ||
    s.weekendConditioning == null ||
    s.nutritionConstraint == null ||
    s.equipment == null
  ) {
    return null;
  }
  return {
    goal: s.goal,
    days_per_week: s.daysPerWeek,
    five_k_pace_seconds_per_km: s.paceSecondsPerKm,
    zone2_habit: s.zone2Habit,
    sled_experience: s.sledExperience,
    olympic_proficiency: s.olympicProficiency,
    weekend_conditioning: s.weekendConditioning,
    nutrition_constraint: s.nutritionConstraint,
    equipment: s.equipment,
  };
}
