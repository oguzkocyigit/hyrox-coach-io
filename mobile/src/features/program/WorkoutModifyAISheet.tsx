/**
 * Mevcut idmani kullanici geri bildirimiyle AI'a degistirtme modali.
 */

import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useModifyWorkout } from "@/api/hooks";
import type { ModifiedWorkoutResponse, WorkoutTemplate } from "@/api/types";
import { estimateDurationMinutes } from "@/features/program/constants";
import { color, radius, space, type } from "@/ui/tokens";

type WorkoutModifyAISheetProps = {
  visible: boolean;
  template: WorkoutTemplate | null;
  onClose: () => void;
  onModified: (result: ModifiedWorkoutResponse) => void;
};

export function WorkoutModifyAISheet({
  visible,
  template,
  onClose,
  onModified,
}: WorkoutModifyAISheetProps) {
  const insets = useSafeAreaInsets();
  const modify = useModifyWorkout();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!template) return null;

  const currentMinutes = estimateDurationMinutes(template);

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError("Lutfen en az 5 karakterlik bir aciklama yaz.");
      return;
    }
    setError(null);
    try {
      const result = await modify.mutateAsync({
        template: {
          name: template.name,
          workout_type: template.workout_type,
          format: template.format,
          rounds: template.rounds,
          time_cap_minutes: template.time_cap_minutes,
          notes: template.notes,
          exercises: template.exercises,
        },
        change_reason: trimmed,
        target_duration_minutes: currentMinutes,
      });
      setReason("");
      onModified(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Idman degistirilemedi.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
        <View style={styles.header}>
          <Text style={styles.title}>AI ile Degistir</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
            <Ionicons name="close" size={24} color={color.text.secondary} />
          </Pressable>
        </View>

        <Text style={styles.workoutName}>{template.name}</Text>
        <Text style={styles.meta}>Mevcut tahmini sure: ~{currentMinutes} dk</Text>

        <Text style={styles.sectionLabel}>Neden degistirmek istiyorsun?</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Orn: Omuz agrisi var, squat yerine daha hafif hareketler istiyorum."
          placeholderTextColor={color.text.secondary}
          multiline
          style={styles.input}
          textAlignVertical="top"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={() => void handleSubmit()}
          disabled={modify.isPending}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitButtonPressed,
            modify.isPending && styles.submitButtonDisabled,
          ]}
        >
          {modify.isPending ? (
            <ActivityIndicator color={color.accent.ink} />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color={color.accent.ink} />
              <Text style={styles.submitText}>Degistir</Text>
            </>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg.base,
    paddingHorizontal: space.screen,
    gap: space.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.sm,
  },
  title: {
    ...type.heading1,
    color: color.text.primary,
  },
  workoutName: {
    ...type.heading2,
    color: color.text.primary,
  },
  meta: {
    ...type.small,
    color: color.text.secondary,
  },
  sectionLabel: {
    ...type.micro,
    color: color.accent.primary,
    marginTop: space.md,
  },
  input: {
    minHeight: 140,
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    padding: space.lg,
    color: color.text.primary,
    ...type.body,
  },
  error: {
    ...type.small,
    color: color.status.danger,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: color.accent.primary,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    marginTop: space.lg,
  },
  submitButtonPressed: {
    backgroundColor: color.accent.pressed,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 16,
    color: color.accent.ink,
  },
});
