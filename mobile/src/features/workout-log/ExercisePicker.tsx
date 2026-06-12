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
  /** Zaten ekli egzersizler listede pasif gosterilir; verilmezse tekrar secilebilir */
  selectedIds?: string[];
  title?: string;
  /** Listede yoksa ozel egzersiz olusturma secenegi */
  allowCustom?: boolean;
  onCreateCustom?: (prefillName: string) => void;
};

export function ExercisePicker({
  visible,
  onClose,
  onSelect,
  selectedIds = [],
  title = "Egzersiz Sec",
  allowCustom = false,
  onCreateCustom,
}: ExercisePickerProps) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<ExerciseCategory | "all">("all");
  const [search, setSearch] = useState("");
  const { data: exercises, isLoading } = useExercises();

  // Her aciliste temiz arama ile basla
  useEffect(() => {
    if (visible) {
      setSearch("");
      setCategory("all");
    }
  }, [visible]);

  const openCustom = () => {
    onCreateCustom?.(search.trim());
    onClose();
  };

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
          <Text style={styles.title}>{title}</Text>
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
              <View style={styles.emptyWrap}>
                <Text style={styles.empty}>
                  {search.trim()
                    ? `"${search.trim()}" ile eslesen egzersiz yok.`
                    : "Bu kategoride egzersiz yok."}
                </Text>
                {allowCustom && onCreateCustom ? (
                  <Pressable
                    onPress={openCustom}
                    style={({ pressed }) => [
                      styles.customButton,
                      pressed && styles.customButtonPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Ozel egzersiz olustur"
                  >
                    <Ionicons name="create-outline" size={18} color={color.accent.primary} />
                    <Text style={styles.customButtonText}>
                      {search.trim()
                        ? `"${search.trim()}" olarak ozel olustur`
                        : "Ozel egzersiz olustur"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )
          }
          ListFooterComponent={
            allowCustom && onCreateCustom && filtered.length > 0 ? (
              <Pressable
                onPress={openCustom}
                style={({ pressed }) => [
                  styles.customFooter,
                  pressed && styles.customButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Listede yok ozel egzersiz olustur"
              >
                <Ionicons name="add-circle-outline" size={18} color={color.text.secondary} />
                <Text style={styles.customFooterText}>
                  Listede yok — ozel egzersiz olustur
                  {search.trim() ? ` ("${search.trim()}")` : ""}
                </Text>
              </Pressable>
            ) : null
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
  },
  emptyWrap: {
    gap: space.lg,
    marginTop: space.huge,
    paddingHorizontal: space.md,
  },
  customButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: color.accent.subtle,
    borderWidth: 1,
    borderColor: color.accent.primary,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
  },
  customButtonPressed: {
    backgroundColor: color.bg.elevated,
  },
  customButtonText: {
    ...type.bodyStrong,
    color: color.accent.primary,
    textAlign: "center",
    flexShrink: 1,
  },
  customFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    marginTop: space.md,
    paddingVertical: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.stroke.subtle,
  },
  customFooterText: {
    ...type.small,
    color: color.text.secondary,
    textAlign: "center",
    flexShrink: 1,
  },
});
