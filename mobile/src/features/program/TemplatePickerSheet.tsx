/**
 * Bir gune idman atarken acilan secici: kayitli sablonlardan sec
 * veya "Yeni Idman Olustur" ile builder'i ac.
 */

import { Ionicons } from "@expo/vector-icons";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTemplates } from "@/api/hooks";
import type { WorkoutTemplate } from "@/api/types";
import {
  estimateDurationMinutes,
  formatMeta,
  typeMeta,
} from "@/features/program/constants";
import { color, radius, space, type } from "@/ui/tokens";

type TemplatePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (template: WorkoutTemplate) => void;
  onCreateNew: () => void;
  onCreateWithAI?: () => void;
};

export function TemplatePickerSheet({
  visible,
  onClose,
  onSelect,
  onCreateNew,
  onCreateWithAI,
}: TemplatePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const { data: templates, isLoading } = useTemplates();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Idman Sec</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
            <Ionicons name="close" size={24} color={color.text.secondary} />
          </Pressable>
        </View>

        {onCreateWithAI ? (
          <Pressable onPress={onCreateWithAI} style={styles.aiRow}>
            <Ionicons name="sparkles" size={22} color={color.accent.ink} />
            <Text style={styles.aiText}>AI ile Olustur</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={onCreateNew} style={styles.createRow}>
          <Ionicons name="add-circle" size={22} color={color.accent.primary} />
          <Text style={styles.createText}>Yeni Idman Olustur</Text>
        </Pressable>

        <FlatList
          data={templates ?? []}
          keyExtractor={(item) => item.template_id}
          contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
          ListEmptyComponent={
            isLoading ? null : (
              <Text style={styles.empty}>
                Henuz kayitli idman yok. Yukaridan yeni olustur.
              </Text>
            )
          }
          renderItem={({ item }) => {
            const meta = typeMeta(item.workout_type);
            return (
              <Pressable
                onPress={() => onSelect(item)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.dot, { backgroundColor: meta.dot }]} />
                <View style={styles.rowTexts}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowMeta}>
                    {meta.label} · {formatMeta(item.format).label} ·{" "}
                    {item.exercises.length} egzersiz · ~
                    {estimateDurationMinutes(item)} dk
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={color.text.secondary} />
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg.base,
    paddingHorizontal: space.screen,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.lg,
  },
  title: {
    ...type.heading1,
    color: color.text.primary,
  },
  aiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: color.accent.primary,
    borderRadius: radius.md,
    padding: space.lg,
    marginBottom: space.sm,
  },
  aiText: {
    ...type.bodyStrong,
    color: color.accent.ink,
  },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: color.accent.subtle,
    borderWidth: 1,
    borderColor: color.accent.primary,
    borderRadius: radius.md,
    padding: space.lg,
    marginBottom: space.lg,
  },
  createText: {
    ...type.bodyStrong,
    color: color.accent.primary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    padding: space.lg,
    marginBottom: space.sm,
  },
  rowPressed: {
    backgroundColor: color.bg.elevated,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowTexts: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    ...type.bodyStrong,
    color: color.text.primary,
  },
  rowMeta: {
    ...type.small,
    color: color.text.secondary,
  },
  empty: {
    ...type.body,
    color: color.text.secondary,
    textAlign: "center",
    marginTop: space.huge,
  },
});
