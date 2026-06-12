import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { color, font, radius, space, type } from "@/ui/tokens";

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function TextField({ label, error, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? color.status.danger
    : focused
      ? color.accent.primary
      : color.stroke.strong;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        style={[styles.input, { borderColor }]}
        placeholderTextColor={color.text.disabled}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.xs + 2,
  },
  label: {
    ...type.micro,
    color: color.text.secondary,
  },
  input: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.sm,
    paddingHorizontal: space.lg,
    height: 48,
    color: color.text.primary,
    fontFamily: font.body.regular,
    fontSize: 15,
  },
  error: {
    ...type.small,
    color: color.status.danger,
  },
});
