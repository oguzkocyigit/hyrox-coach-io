import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { color, font, radius } from "@/ui/tokens";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Footer gibi esit yukseklik gereken yerlerde ikisine de lg ver */
  size?: "md" | "lg";
};

const HEIGHTS = { md: 44, lg: 52 } as const;

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  size,
}: ButtonProps) {
  const isInactive = disabled || loading;
  const height = size ? HEIGHTS[size] : variant === "primary" ? HEIGHTS.lg : HEIGHTS.md;
  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        { height },
        pressed && variantPressed[variant],
        isInactive && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? color.accent.ink : color.text.primary} />
      ) : (
        <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: font.body.semibold,
    fontSize: 15,
  },
  primary: {
    backgroundColor: color.accent.primary,
  },
  secondary: {
    borderWidth: 1,
    borderColor: color.stroke.strong,
  },
  ghost: {},
  destructive: {
    borderWidth: 1,
    borderColor: color.status.danger,
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantPressed = StyleSheet.create({
  primary: { backgroundColor: color.accent.pressed },
  secondary: { backgroundColor: color.bg.elevated },
  ghost: { backgroundColor: color.bg.elevated },
  destructive: { backgroundColor: color.status.dangerSubtle },
});

const labelStyles = StyleSheet.create({
  primary: { color: color.accent.ink },
  secondary: { color: color.text.primary },
  ghost: { color: color.text.secondary },
  destructive: { color: color.status.danger },
});
