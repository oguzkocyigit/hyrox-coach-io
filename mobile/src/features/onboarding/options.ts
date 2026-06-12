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
  TimeOfDay,
  TimeWindow,
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
    value: "hybrid",
    label: "Hibrit",
    description: "HYROX tarzi: guc + kondisyon dengesi",
    icon: "flash-outline",
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

export const TIME_OF_DAY_OPTIONS: Option<TimeOfDay>[] = [
  {
    value: "morning",
    label: "Sabah",
    description: "06:00 – 11:00 arasi tercih",
    icon: "sunny-outline",
  },
  {
    value: "afternoon",
    label: "Ogle / Ogleden sonra",
    description: "11:00 – 17:00 arasi",
    icon: "partly-sunny-outline",
  },
  {
    value: "evening",
    label: "Aksam",
    description: "17:00 – 21:00 arasi",
    icon: "moon-outline",
  },
  {
    value: "flexible",
    label: "Esnek",
    description: "Gun icinde saat onemli degil",
    icon: "shuffle-outline",
  },
];

export const TIME_WINDOW_OPTIONS: Option<TimeWindow>[] = [
  { value: "05_08", label: "05:00 – 08:00", description: "Erken sabah", icon: "alarm-outline" },
  { value: "08_11", label: "08:00 – 11:00", description: "Sabah", icon: "sunny-outline" },
  { value: "11_14", label: "11:00 – 14:00", description: "Ogle", icon: "restaurant-outline" },
  { value: "14_17", label: "14:00 – 17:00", description: "Ogleden sonra", icon: "walk-outline" },
  { value: "17_20", label: "17:00 – 20:00", description: "Aksam", icon: "fitness-outline" },
  { value: "20_22", label: "20:00 – 22:00", description: "Gec aksam", icon: "moon-outline" },
  {
    value: "flexible",
    label: "Esnek",
    description: "Belirli saat araligi yok",
    icon: "time-outline",
  },
];

export const FED_STATE_OPTIONS: Option<FedState>[] = [
  {
    value: "fed",
    label: "Tok karnina",
    description: "Ogun sonrasi veya oncesi atistirmali ile",
    icon: "restaurant-outline",
  },
  {
    value: "fasted",
    label: "Ac karnina",
    description: "Kardiyo / sabah idmanlari icin",
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
