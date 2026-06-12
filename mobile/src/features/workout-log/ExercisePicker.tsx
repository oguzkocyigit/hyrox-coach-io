import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useExercises } from "@/api/hooks";
import type { Exercise, ExerciseCategory } from "@/api/types";
import { color, font, radius, space, type } from "@/ui/tokens";

const CATEGORIES: { id: ExerciseCategory | "all"; label: string }[] = [
  { id: "all", label: "Tumu" },
  { id: "strength", label: "Kuvvet" },
  { id: "hyrox", label: "HYROX" },
  { id: "olympic", label: "Olimpik" },
  { id: "crossfit", label: "CrossFit" },
  { id: "running", label: "Kosu" },
];

type ExercisePickerProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  /** Zaten ekli egzersizler listede pasif gosterilir */
  selectedIds: string[];
};

export function ExercisePicker({ visible, onClose, onSelect, selectedIds }: ExercisePickerProps) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<ExerciseCategory | "all">("all");
  const [search, setSearch] = useState("");
  const { data: exercises, isLoading } = useExercises();

  // Her aciliste temiz arama ile basla
  useEffect(() => {
    if (visible) setSearch("");
  }, [visible]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (exercises ?? []).filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [exercises, category, search]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Egzersiz Sec</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
            <Ionicons name="close" size={24} color={color.text.secondary} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={color.text.secondary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Egzersiz ara..."
            placeholderTextColor={color.text.disabled}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Egzersiz ara"
          />
          {search ? (
            <Pressable
              onPress={() => setSearch("")}
              hitSlop={8}
              accessibilityLabel="Aramayi temizle"
            >
              <Ionicons name="close-circle" size={16} color={color.text.secondary} />
            </Pressable>
          ) : null}
        </View>

        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            {CATEGORIES.map((c) => {
              const active = c.id === category;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={[styles.categoryPill, active && styles.categoryPillActive]}
                >
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.exercise_id}
          contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            isLoading ? null : (
              <Text style={styles.empty}>
                {search.trim()
                  ? `"${search.trim()}" ile eslesen egzersiz yok.`
                  : "Bu kategoride egzersiz yok."}
              </Text>
            )
          }
          renderItem={({ item }) => {
            const alreadyAdded = selectedIds.includes(item.exercise_id);
            return (
              <Pressable
                onPress={() => {
                  if (!alreadyAdded) {
                    onSelect(item);
                    onClose();
                  }
                }}
                disabled={alreadyAdded}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                  alreadyAdded && styles.rowDisabled,
                ]}
              >
                <View style={styles.rowTexts}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowMeta}>
                    {Object.keys(item.target_muscles).join(" · ")}
                  </Text>
                </View>
                {alreadyAdded ? (
                  <Ionicons name="checkmark" size={18} color={color.status.safe} />
                ) : (
                  <Ionicons name="add" size={18} color={color.accent.primary} />
                )}
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
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 44,
    marginBottom: space.md,
  },
  searchInput: {
    flex: 1,
    color: color.text.primary,
    fontFamily: font.body.regular,
    fontSize: 15,
  },
  categories: {
    flexDirection: "row",
    gap: space.sm,
    marginBottom: space.lg,
  },
  categoryPill: {
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  categoryPillActive: {
    backgroundColor: color.accent.primary,
    borderColor: color.accent.primary,
  },
  categoryText: {
    ...type.small,
    color: color.text.secondary,
  },
  categoryTextActive: {
    color: color.accent.ink,
    fontFamily: "Manrope_600SemiBold",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  rowDisabled: {
    opacity: 0.5,
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
