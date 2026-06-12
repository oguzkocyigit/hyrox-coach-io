/**
 * AI Onboarding Wizard gecici durum deposu (Zustand).
 */

import { create } from "zustand";

import type {
  EquipmentLevel,
  FedState,
  NutritionConstraint,
  OlympicProficiency,
  OnboardingPayload,
  SledExperience,
  TimeOfDay,
  TimeWindow,
  TrainingGoal,
  Zone2Habit,
} from "@/api/types";

export type OnboardingAnswers = {
  goal: TrainingGoal | null;
  paceSecondsPerKm: number;
  zone2Habit: Zone2Habit | null;
  sledExperience: SledExperience | null;
  olympicProficiency: OlympicProficiency | null;
  weekendConditioning: boolean | null;
  nutritionConstraint: NutritionConstraint | null;
  equipment: EquipmentLevel | null;
  /** 0=Pzt ... 6=Paz salon/idman gunleri */
  trainingDays: number[];
  wantsRunning: boolean;
  runningDays: number[];
  splitRunAndGym: boolean | null;
  gymTimeOfDay: TimeOfDay | null;
  runTimeOfDay: TimeOfDay | null;
  gymTimeWindow: TimeWindow | null;
  runTimeWindow: TimeWindow | null;
  gymFedState: FedState | null;
  runFedState: FedState | null;
  gymDurationMinutes: number;
  runDurationMinutes: number;
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
  trainingDays: [0, 2, 4, 5],
  wantsRunning: true,
  runningDays: [1, 3, 6],
  splitRunAndGym: null,
  gymTimeOfDay: null,
  runTimeOfDay: null,
  gymTimeWindow: null,
  runTimeWindow: null,
  gymFedState: null,
  runFedState: null,
  gymDurationMinutes: 60,
  runDurationMinutes: 45,
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

/** Kosu + salon ayni gune denk geliyor mu */
export function hasOverlappingDays(s: OnboardingAnswers): boolean {
  if (!s.wantsRunning) return false;
  const run = new Set(s.runningDays);
  return s.trainingDays.some((d) => run.has(d));
}

export function buildPayload(s: OnboardingAnswers): OnboardingPayload | null {
  if (
    s.goal == null ||
    s.zone2Habit == null ||
    s.sledExperience == null ||
    s.olympicProficiency == null ||
    s.weekendConditioning == null ||
    s.nutritionConstraint == null ||
    s.equipment == null ||
    s.gymTimeOfDay == null ||
    s.gymTimeWindow == null ||
    s.gymFedState == null
  ) {
    return null;
  }
  if (s.trainingDays.length < 2) return null;
  if (s.wantsRunning) {
    if (
      s.runningDays.length < 1 ||
      s.runTimeOfDay == null ||
      s.runTimeWindow == null ||
      s.runFedState == null
    ) {
      return null;
    }
  }
  if (hasOverlappingDays(s) && s.splitRunAndGym == null) return null;

  return {
    goal: s.goal,
    training_days: s.trainingDays,
    days_per_week: s.trainingDays.length,
    wants_running: s.wantsRunning,
    running_days: s.wantsRunning ? s.runningDays : [],
    split_run_and_gym: hasOverlappingDays(s) ? (s.splitRunAndGym ?? true) : false,
    gym_time_of_day: s.gymTimeOfDay,
    run_time_of_day: s.wantsRunning ? s.runTimeOfDay! : "flexible",
    gym_time_window: s.gymTimeWindow,
    run_time_window: s.wantsRunning ? s.runTimeWindow! : "flexible",
    gym_fed_state: s.gymFedState,
    run_fed_state: s.wantsRunning ? s.runFedState! : "flexible",
    gym_duration_minutes: s.gymDurationMinutes,
    run_duration_minutes: s.wantsRunning ? s.runDurationMinutes : 45,
    five_k_pace_seconds_per_km: s.paceSecondsPerKm,
    zone2_habit: s.zone2Habit,
    sled_experience: s.sledExperience,
    olympic_proficiency: s.olympicProficiency,
    weekend_conditioning: s.weekendConditioning,
    nutrition_constraint: s.nutritionConstraint,
    equipment: s.equipment,
  };
}
