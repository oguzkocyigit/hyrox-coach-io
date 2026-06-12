/**
 * EMBER tasarim sistemi tokenlari. Kaynak: DESIGN_SYSTEM.md
 * Bilesenler hex KULLANMAZ; her zaman bu nesneden okur.
 */

export const color = {
  bg: {
    base: "#0F1316",
    surface: "#171D21",
    elevated: "#1F262B",
  },
  stroke: {
    subtle: "#242C31",
    strong: "#39444B",
  },
  accent: {
    primary: "#FF5A1F",
    pressed: "#E04A12",
    subtle: "rgba(255, 90, 31, 0.12)",
    ink: "#0F1316",
  },
  text: {
    primary: "#ECEFF1",
    secondary: "#7E8B94",
    disabled: "#4D575E",
  },
  status: {
    safe: "#2BD9A8",
    caution: "#FFC247",
    danger: "#FF4757",
    dangerSubtle: "rgba(255, 71, 87, 0.12)",
    info: "#5AA9FF",
  },
  /** Kategorik rozet renkleri (idman tipleri vb.) — durum anlami tasimaz. */
  categorical: {
    green: "#2BD9A8",
    blue: "#5AA9FF",
    purple: "#A78BFA",
    amber: "#FFC247",
    sky: "#38BDF8",
    red: "#FF4757",
    orange: "#F59E0B",
    mint: "#34D399",
  },
} as const;

export const font = {
  display: {
    semibold: "ChakraPetch_600SemiBold",
    bold: "ChakraPetch_700Bold",
  },
  body: {
    regular: "Manrope_400Regular",
    medium: "Manrope_500Medium",
    semibold: "Manrope_600SemiBold",
  },
  data: {
    regular: "FiraCode_400Regular",
    medium: "FiraCode_500Medium",
  },
} as const;

/** Tipografi olcegi: fontFamily + boyut + satir yuksekligi birlikte. */
export const type = {
  displayXl: { fontFamily: font.display.bold, fontSize: 44, lineHeight: 48 },
  displayLg: { fontFamily: font.display.semibold, fontSize: 32, lineHeight: 36 },
  heading1: { fontFamily: font.display.semibold, fontSize: 24, lineHeight: 30 },
  heading2: { fontFamily: font.body.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: font.body.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: font.body.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: font.body.regular, fontSize: 13, lineHeight: 18 },
  micro: {
    fontFamily: font.data.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.88,
    textTransform: "uppercase" as const,
  },
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  /** Ekran kenar boslugu */
  screen: 20,
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  full: 9999,
} as const;

/** Kural motoru gorsellestirme sabitleri (backend ile ayni). */
export const chart = {
  /** Haftalik kas yuku eşigi (PROJE_BLUEPRINT Bolum 4.A) */
  muscleThreshold: 22,
  /** Bar olcek maksimumu: esik %79 konumda durur */
  muscleBarMax: 28,
  /** Esige bu kadar yaklasinca 'caution' rengi */
  cautionBand: 4,
} as const;

/** Yuk degerine gore semantik renk (asla accent degil). */
export function loadColor(load: number): string {
  if (load > chart.muscleThreshold) return color.status.danger;
  if (load >= chart.muscleThreshold - chart.cautionBand) return color.status.caution;
  return color.status.safe;
}
