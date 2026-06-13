/**
 * Secilen gun icin AI ile tek seanslik idman uretimi.
 */

import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGenerateDayWorkout } from "@/api/hooks";
import type { GeneratedDayWorkout, SessionKind } from "@/api/types";
import { Slider } from "@/features/onboarding/Slider";
import {
  buildAthleteContext,
  gymDurationMinutes,
  useOnboardingStore,
} from "@/features/onboarding/store";
import { color, radius, space, type } from "@/ui/tokens";

const SESSION_OPTIONS: { id: SessionKind; label: string; icon: string }[] = [
  { id: "gym", label: "Salon", icon: "barbell-outline" },
  { id: "running", label: "Kosu", icon: "walk-outline" },
  { id: "hybrid", label: "Hibrit", icon: "flash-outline" },
];

type DayWorkoutAISheetProps = {
  visible: boolean;
  scheduledDate: string | null;
  dayOfWeek: number;
  onClose: () => void;
  onGenerated: (result: GeneratedDayWorkout) => void;
};

export function DayWorkoutAISheet({
  visible,
  scheduledDate,
  dayOfWeek,
  onClose,
  onGenerated,
}: DayWorkoutAISheetProps) {
  const insets = useSafeAreaInsets();
  const onboarding = useOnboardingStore();
  const generate = useGenerateDayWorkout();

  const defaultDuration = useMemo(() => {
    const d = gymDurationMinutes(onboarding);
    return d > 0 ? d : 60;
  }, [onboarding.gymStartMinutes, onboarding.gymEndMinutes]);

  const [sessionKind, setSessionKind] = useState<SessionKind>("gym");
  const [durationMinutes, setDurationMinutes] = useState(defaultDuration);
  const [error, setError] = useState<string | null>(null);

  const athleteContext = useMemo(() => buildAthleteContext(onboarding), [onboarding]);

  const handleGenerate = async () => {
    setError(null);
    try {
      const result = await generate.mutateAsync({
        day_of_week: dayOfWeek,
        session_kind: sessionKind,
        duration_minutes: durationMinutes,
        athlete_context: athleteContext,
      });
      onGenerated(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Idman uretilemedi.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>AI ile Olustur</Text>
            {scheduledDate ? (
              <Text style={styles.subtitle}>{scheduledDate} icin idman</Text>
            ) : null}
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
            <Ionicons name="close" size={24} color={color.text.secondary} />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Seans turu</Text>
        <View style={styles.sessionRow}>
          {SESSION_OPTIONS.map((option) => {
            const active = sessionKind === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setSessionKind(option.id)}
                style={[styles.sessionChip, active && styles.sessionChipActive]}
              >
                <Ionicons
                  name={option.icon as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={active ? color.accent.ink : color.text.secondary}
                />
                <Text style={[styles.sessionText, active && styles.sessionTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Hedef sure</Text>
        <Slider
          min={30}
          max={120}
          step={5}
          value={durationMinutes}
          onChange={setDurationMinutes}
          formatValue={(v) => `${v} dk`}
          minLabel="30 dk"
          maxLabel="120 dk"
        />

        <Text style={styles.hint}>
          AI idmani bu sureye gore olusturur. Uzun salon idmanlari icin 60-90+ dk
          sec.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={() => void handleGenerate()}
          disabled={generate.isPending}
          style={({ pressed }) => [
            styles.generateButton,
            pressed && styles.generateButtonPressed,
            generate.isPending && styles.generateButtonDisabled,
          ]}
        >
          {generate.isPending ? (
            <ActivityIndicator color={color.accent.ink} />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color={color.accent.ink} />
              <Text style={styles.generateText}>Idman Olustur</Text>
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
    gap: space.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: space.sm,
  },
  title: {
    ...type.heading1,
    color: color.text.primary,
  },
  subtitle: {
    ...type.small,
    color: color.text.secondary,
    marginTop: space.xs,
  },
  sectionLabel: {
    ...type.micro,
    color: color.accent.primary,
  },
  sessionRow: {
    flexDirection: "row",
    gap: space.sm,
  },
  sessionChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    paddingVertical: space.md,
    backgroundColor: color.bg.surface,
  },
  sessionChipActive: {
    backgroundColor: color.accent.primary,
    borderColor: color.accent.primary,
  },
  sessionText: {
    ...type.small,
    color: color.text.secondary,
  },
  sessionTextActive: {
    color: color.accent.ink,
    fontFamily: "Manrope_600SemiBold",
  },
  hint: {
    ...type.small,
    color: color.text.secondary,
    fontStyle: "italic",
  },
  error: {
    ...type.small,
    color: color.status.danger,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: color.accent.primary,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    marginTop: space.md,
  },
  generateButtonPressed: {
    backgroundColor: color.accent.pressed,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 16,
    color: color.accent.ink,
  },
});
