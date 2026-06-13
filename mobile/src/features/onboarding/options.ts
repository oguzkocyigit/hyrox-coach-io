/**
 * Onboarding sihirbazi secenek tanimlari (etiket + aciklama + ikon).
 * Degerler backend OnboardingPayload literalleri ile birebir ayni.
 */

import type { Ionicons } from "@expo/vector-icons";

import type {
  EquipmentLevel,
  FedState,
  NutritionConstraint,
  OlympicProficiency,
  SledExperience,
  TrainingGoal,
  Zone2Habit,
} from "@/api/types";

export type Option<T extends string | boolean> = {
  value: T;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const GOAL_OPTIONS: Option<TrainingGoal>[] = [
  {
    value: "strength",
    label: "Guc",
    description: "Maksimal kuvvet ve kas gelisimi onceligi",
    icon: "barbell-outline",
  },
  {
    value: "conditioning",
    label: "Kondisyon",
    description: "Motor kapasitesi, dayaniklilik ve tempo",
    icon: "pulse-outline",
  },
  {
    value: "hyrox",
    label: "Hyrox",
    description: "Yaris hazirligi: station + kosu entegrasyonu",
    icon: "flag-outline",
  },
  {
    value: "hybrid",
    label: "Hibrit",
    description: "Guc + kondisyon dengesi (genel performans)",
    icon: "flash-outline",
  },
  {
    value: "crossfit",
    label: "Crossfit",
    description: "Cesitli WOD'lar, metcon ve beceri calismasi",
    icon: "fitness-outline",
  },
];

export const ZONE2_OPTIONS: Option<Zone2Habit>[] = [
  {
    value: "none",
    label: "Yapmiyorum",
    description: "Dusuk tempolu uzun kosu aliskanligim yok",
    icon: "close-circle-outline",
  },
  {
    value: "sometimes",
    label: "Ara sira",
    description: "Haftada 1 veya duzensiz Zone 2 seansi",
    icon: "remove-circle-outline",
  },
  {
    value: "regular",
    label: "Duzenli",
    description: "Haftada 2+ Zone 2 seansi aliskanligim var",
    icon: "checkmark-circle-outline",
  },
];

export const SLED_OPTIONS: Option<SledExperience>[] = [
  {
    value: "none",
    label: "Hic",
    description: "Sled push/pull deneyimim yok",
    icon: "close-circle-outline",
  },
  {
    value: "some",
    label: "Biraz",
    description: "Birkac kez denedim, teknik gelisiyor",
    icon: "remove-circle-outline",
  },
  {
    value: "confident",
    label: "Rahatim",
    description: "Yarissal agirliklarda rahat calisiyorum",
    icon: "checkmark-circle-outline",
  },
];

export const OLYMPIC_OPTIONS: Option<OlympicProficiency>[] = [
  {
    value: "none",
    label: "Bilmiyorum",
    description: "Snatch / Clean & Jerk calismadim",
    icon: "close-circle-outline",
  },
  {
    value: "learning",
    label: "Ogreniyorum",
    description: "Teknik calisiyorum, hafif agirliklar",
    icon: "school-outline",
  },
  {
    value: "proficient",
    label: "Hakimim",
    description: "Olimpik kaldirislari guvenle programlarim",
    icon: "trophy-outline",
  },
];

export const WEEKEND_OPTIONS: Option<boolean>[] = [
  {
    value: true,
    label: "Hafta sonu",
    description: "Agir kondisyon gunleri Cumartesi/Pazar olsun",
    icon: "calendar-outline",
  },
  {
    value: false,
    label: "Fark etmez",
    description: "Program haftaya serbestce dagitilsin",
    icon: "shuffle-outline",
  },
];

export const NUTRITION_OPTIONS: Option<NutritionConstraint>[] = [
  {
    value: "none",
    label: "Kisit yok",
    description: "Standart beslenme duzeni",
    icon: "restaurant-outline",
  },
  {
    value: "omad",
    label: "OMAD",
    description: "Gunde tek ogun — hacim buna gore ayarlanir",
    icon: "time-outline",
  },
  {
    value: "intermittent_fasting",
    label: "Aralikli oruc",
    description: "IF penceresi (16/8 vb.)",
    icon: "hourglass-outline",
  },
  {
    value: "low_carb",
    label: "Dusuk karbonhidrat",
    description: "Glikojen-yogun seanslar sinirlanir",
    icon: "leaf-outline",
  },
];

export const EQUIPMENT_OPTIONS: Option<EquipmentLevel>[] = [
  {
    value: "full_box",
    label: "Tam tesekkullu Box",
    description: "Sled, SkiErg, halter platformu, wall ball",
    icon: "business-outline",
  },
  {
    value: "standard_gym",
    label: "Standart salon",
    description: "Makineler + serbest agirlik; sled/erg yok",
    icon: "fitness-outline",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Dambil, vucut agirligi ve kosu",
    icon: "walk-outline",
  },
];

/** Saniye/km degerini "5:30 /km" formatina cevirir. */
export function formatPace(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

export const FED_STATE_OPTIONS: Option<FedState>[] = [
  {
    value: "fed",
    label: "Idman oncesi yedim",
    description: "Atistirmali veya hafif ogun ile idmana cikarim",
    icon: "restaurant-outline",
  },
  {
    value: "fasted",
    label: "Idmandan once yemem",
    description: "Ac seans — genelde sabah kardiyo / Zone 2",
    icon: "water-outline",
  },
  {
    value: "flexible",
    label: "Fark etmez",
    description: "Programa gore ayarlanir",
    icon: "shuffle-outline",
  },
];

export const SPLIT_SESSION_OPTIONS: Option<boolean>[] = [
  {
    value: true,
    label: "Ayri seanslar",
    description: "Ornek: sabah kosu, aksam salon",
    icon: "git-branch-outline",
  },
  {
    value: false,
    label: "Tek blok",
    description: "Ayni gun hibrit idman (kosu + salon bir arada)",
    icon: "layers-outline",
  },
];
