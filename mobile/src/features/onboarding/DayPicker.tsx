/**
 * Haftanin gunlerini coklu secim (0=Pazartesi ... 6=Pazar).
 * EMBER: secili gun turuncu dolgu, dokunma hedefi >= 44pt.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";

import { color, font, radius, space, type } from "@/ui/tokens";

const DAY_SHORT = ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"];

type DayPickerProps = {
  label: string;
  selected: number[];
  onChange: (days: number[]) => void;
  /** Secilebilir gunler; verilmezse hepsi acik */
  allowed?: number[];
};

export function DayPicker({ label, selected, onChange, allowed }: DayPickerProps) {
  const allowedSet = allowed ? new Set(allowed) : null;

  const toggle = (day: number) => {
    if (allowedSet && !allowedSet.has(day)) return;
    if (selected.includes(day)) {
      onChange(selected.filter((d) => d !== day).sort((a, b) => a - b));
    } else {
      onChange([...selected, day].sort((a, b) => a - b));
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {DAY_SHORT.map((short, day) => {
          const isSelected = selected.includes(day);
          const disabled = allowedSet != null && !allowedSet.has(day);
          return (
            <Pressable
              key={day}
              onPress={() => toggle(day)}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected, disabled }}
              style={({ pressed }) => [
                styles.pill,
                isSelected && styles.pillSelected,
                disabled && styles.pillDisabled,
                pressed && !disabled && styles.pillPressed,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  isSelected && styles.pillTextSelected,
                  disabled && styles.pillTextDisabled,
                ]}
              >
                {short}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {selected.length > 0 ? (
        <Text style={styles.hint}>{selected.length} gun secildi</Text>
      ) : (
        <Text style={styles.hintMuted}>En az bir gun sec</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
  },
  label: {
    ...type.micro,
    color: color.text.secondary,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space.xs,
  },
  pill: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: color.stroke.subtle,
    backgroundColor: color.bg.surface,
  },
  pillSelected: {
    backgroundColor: color.accent.primary,
    borderColor: color.accent.primary,
  },
  pillDisabled: {
    opacity: 0.35,
  },
  pillPressed: {
    backgroundColor: color.bg.elevated,
  },
  pillText: {
    fontFamily: font.body.semibold,
    fontSize: 13,
    color: color.text.secondary,
  },
  pillTextSelected: {
    color: color.accent.ink,
  },
  pillTextDisabled: {
    color: color.text.disabled,
  },
  hint: {
    ...type.small,
    color: color.accent.primary,
  },
  hintMuted: {
    ...type.small,
    color: color.text.disabled,
  },
});
