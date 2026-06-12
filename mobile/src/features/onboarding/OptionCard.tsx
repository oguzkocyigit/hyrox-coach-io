/**
 * Typeform tarzi genis dokunmatik secenek karti (>= 64pt hedef).
 * Secili durumda ember turuncusu cerceve + subtle dolgu.
 */

import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { color, font, radius, space, type } from "@/ui/tokens";

type OptionCardProps = {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
};

export function OptionCard({ label, description, icon, selected, onPress }: OptionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.iconBox, selected && styles.iconBoxSelected]}>
        <Ionicons
          name={icon}
          size={20}
          color={selected ? color.accent.primary : color.text.secondary}
        />
      </View>
      <View style={styles.texts}>
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Ionicons
        name={selected ? "checkmark-circle" : "ellipse-outline"}
        size={22}
        color={selected ? color.accent.primary : color.stroke.strong}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 72,
    backgroundColor: color.bg.surface,
    borderWidth: 1.5,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  cardSelected: {
    borderColor: color.accent.primary,
    backgroundColor: color.accent.subtle,
  },
  cardPressed: {
    backgroundColor: color.bg.elevated,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: color.bg.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxSelected: {
    backgroundColor: color.bg.surface,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...type.bodyStrong,
    fontSize: 16,
    color: color.text.primary,
  },
  labelSelected: {
    fontFamily: font.body.semibold,
  },
  description: {
    ...type.small,
    color: color.text.secondary,
  },
});
