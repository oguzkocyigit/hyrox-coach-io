/**
 * Salon veya kosu icin saat araligi secimi (baslangic / bitis).
 * Idman suresi araliktan otomatik turetilir.
 */

import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  durationMinutesFromRange,
  formatTimeRange,
  minutesToTimeString,
  timeOptions,
} from "@/features/onboarding/timeUtils";
import { color, radius, space, type } from "@/ui/tokens";

type SessionScheduleCardProps = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  startMinutes: number;
  endMinutes: number;
  onStartChange: (minutes: number) => void;
  onEndChange: (minutes: number) => void;
};

const DAY_START = 5 * 60;
const DAY_END = 22 * 60;
const MIN_WINDOW = 30;

function TimeChip({
  value,
  selected,
  onPress,
}: {
  value: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {minutesToTimeString(value)}
      </Text>
    </Pressable>
  );
}

function TimeRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (minutes: number) => void;
}) {
  return (
    <View style={styles.timeRow}>
      <Text style={styles.timeRowLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {options.map((t) => (
          <TimeChip key={t} value={t} selected={t === value} onPress={() => onChange(t)} />
        ))}
      </ScrollView>
    </View>
  );
}

export function SessionScheduleCard({
  title,
  icon,
  startMinutes,
  endMinutes,
  onStartChange,
  onEndChange,
}: SessionScheduleCardProps) {
  const startOptions = timeOptions(DAY_START, DAY_END - MIN_WINDOW);
  const endOptions = timeOptions(startMinutes + MIN_WINDOW, DAY_END);
  const duration = durationMinutesFromRange(startMinutes, endMinutes);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={18} color={color.accent.primary} />
        </View>
        <View style={styles.headerTexts}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.rangeHint}>
            {formatTimeRange(startMinutes, endMinutes)} · ~{duration} dk
          </Text>
        </View>
      </View>

      <TimeRow label="BASLANGIC" value={startMinutes} options={startOptions} onChange={onStartChange} />
      <TimeRow label="BITIS" value={endMinutes} options={endOptions} onChange={onEndChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: color.accent.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTexts: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.bodyStrong,
    fontSize: 16,
    color: color.text.primary,
  },
  rangeHint: {
    ...type.small,
    color: color.text.secondary,
  },
  timeRow: {
    gap: space.xs,
  },
  timeRowLabel: {
    ...type.micro,
    color: color.text.secondary,
  },
  chipRow: {
    gap: space.sm,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    backgroundColor: color.bg.elevated,
  },
  chipSelected: {
    borderColor: color.accent.primary,
    backgroundColor: color.accent.subtle,
  },
  chipText: {
    ...type.small,
    color: color.text.secondary,
    fontVariant: ["tabular-nums"],
  },
  chipTextSelected: {
    color: color.text.primary,
  },
});
