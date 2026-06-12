/**
 * Idman kutuphanesi (RoxHype "Workouts" ekrani karsiligi):
 * arama, tip filtresi pilleri, egzersiz onizlemeli sablon kartlari,
 * duzenle/sil aksiyonlari ve yeni olusturma FAB'i.
 */

import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import { useDeleteTemplate, useTemplates } from "@/api/hooks";
import type { PlanWorkoutType, WorkoutTemplate } from "@/api/types";
import {
  estimateDurationMinutes,
  exerciseSummary,
  typeMeta,
  WORKOUT_TYPES,
} from "@/features/program/constants";
import { WorkoutBuilderSheet } from "@/features/program/WorkoutBuilderSheet";
import { WorkoutDetailSheet } from "@/features/program/WorkoutDetailSheet";
import { color, font, radius, space, type } from "@/ui/tokens";

const PREVIEW_COUNT = 3;

type WorkoutLibrarySheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function WorkoutLibrarySheet({ visible, onClose }: WorkoutLibrarySheetProps) {
  const insets = useSafeAreaInsets();
  const { data: templates, isLoading } = useTemplates();
  const deleteTemplate = useDeleteTemplate();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<PlanWorkoutType | "all">("all");
  const [builderVisible, setBuilderVisible] = useState(false);
  const [builderTemplate, setBuilderTemplate] = useState<WorkoutTemplate | null>(null);
  const [detailTemplate, setDetailTemplate] = useState<WorkoutTemplate | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (templates ?? []).filter((t) => {
      if (typeFilter !== "all" && t.workout_type !== typeFilter) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [templates, search, typeFilter]);

  const handleDelete = (template: WorkoutTemplate) => {
    Alert.alert(
      "Idmani Sil",
      `"${template.name}" kalici olarak silinsin mi? Plana atanmis gunler de kaldirilir.`,
      [
        { text: "Vazgec", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => void deleteTemplate.mutateAsync(template.template_id),
        },
      ],
    );
  };

  const openBuilder = (template: WorkoutTemplate | null) => {
    setBuilderTemplate(template);
    setBuilderVisible(true);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
            <Ionicons name="close" size={24} color={color.text.secondary} />
          </Pressable>
          <Text style={styles.title}>Idmanlarim</Text>
          <Pressable
            onPress={() => openBuilder(null)}
            style={styles.createButton}
            accessibilityLabel="Yeni idman olustur"
          >
            <Ionicons name="add" size={16} color={color.accent.ink} />
            <Text style={styles.createButtonText}>Olustur</Text>
          </Pressable>
        </View>

        {/* Arama */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={color.text.secondary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Idman ara..."
            placeholderTextColor={color.text.disabled}
            autoCorrect={false}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={color.text.secondary} />
            </Pressable>
          ) : null}
        </View>

        {/* Tip filtresi */}
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <Pressable
              onPress={() => setTypeFilter("all")}
              style={[styles.filterPill, typeFilter === "all" && styles.filterPillActive]}
            >
              <Text
                style={[
                  styles.filterText,
                  typeFilter === "all" && styles.filterTextActive,
                ]}
              >
                Tumu
              </Text>
            </Pressable>
            {WORKOUT_TYPES.map((t) => {
              const active = typeFilter === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTypeFilter(active ? "all" : t.id)}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <View style={[styles.dot, { backgroundColor: t.dot }]} />
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {isLoading ? (
          <ActivityIndicator color={color.accent.primary} style={styles.loading} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.template_id}
            contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {search || typeFilter !== "all"
                    ? "Filtreyle eslesen idman yok."
                    : "Henuz idman olusturmadin.\n\"Olustur\" ile ilk sablonunu kur."}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const meta = typeMeta(item.workout_type);
              const preview = item.exercises.slice(0, PREVIEW_COUNT);
              const remaining = item.exercises.length - preview.length;
              return (
                <Pressable
                  onPress={() => setDetailTemplate(item)}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <View style={[styles.typeBadge, { borderColor: meta.dot }]}>
                      <View style={[styles.dot, { backgroundColor: meta.dot }]} />
                      <Text style={styles.typeBadgeText}>{meta.label}</Text>
                    </View>
                  </View>

                  <View style={styles.cardMetaRow}>
                    <Ionicons name="time-outline" size={13} color={color.text.secondary} />
                    <Text style={styles.cardMeta}>
                      ~{estimateDurationMinutes(item)} dk
                    </Text>
                    <Ionicons
                      name="barbell-outline"
                      size={13}
                      color={color.text.secondary}
                    />
                    <Text style={styles.cardMeta}>{item.exercises.length} egzersiz</Text>
                    <View style={styles.cardActions}>
                      <Pressable
                        onPress={() => openBuilder(item)}
                        hitSlop={8}
                        style={styles.iconButton}
                        accessibilityLabel="Duzenle"
                      >
                        <Ionicons
                          name="create-outline"
                          size={17}
                          color={color.accent.primary}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => handleDelete(item)}
                        hitSlop={8}
                        style={styles.iconButton}
                        accessibilityLabel="Sil"
                      >
                        <Ionicons
                          name="trash-outline"
                          size={17}
                          color={color.status.danger}
                        />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.previewList}>
                    {preview.map((exercise, index) => (
                      <Text key={`${exercise.name}-${index}`} style={styles.previewItem}>
                        · {exercise.name}{" "}
                        <Text style={styles.previewMeta}>
                          ({exerciseSummary(exercise)})
                        </Text>
                      </Text>
                    ))}
                    {remaining > 0 ? (
                      <Text style={styles.previewMore}>+{remaining} egzersiz daha</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {/* FAB */}
        <Pressable
          onPress={() => openBuilder(null)}
          style={[styles.fab, { bottom: insets.bottom + space.xl }]}
          accessibilityLabel="Yeni idman olustur"
        >
          <Ionicons name="add" size={28} color={color.accent.ink} />
        </Pressable>
      </View>

      <WorkoutBuilderSheet
        visible={builderVisible}
        template={builderTemplate}
        onClose={() => setBuilderVisible(false)}
      />

      <WorkoutDetailSheet
        visible={detailTemplate != null}
        template={detailTemplate}
        onClose={() => setDetailTemplate(null)}
        onEdit={(template) => {
          setDetailTemplate(null);
          openBuilder(template);
        }}
      />
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
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.lg,
  },
  title: {
    ...type.heading1,
    color: color.text.primary,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    backgroundColor: color.accent.primary,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  createButtonText: {
    fontFamily: font.body.semibold,
    fontSize: 13,
    color: color.accent.ink,
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
  filterRow: {
    flexDirection: "row",
    gap: space.sm,
    paddingBottom: space.md,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs + 2,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: color.bg.surface,
  },
  filterPillActive: {
    backgroundColor: color.accent.primary,
    borderColor: color.accent.primary,
  },
  filterText: {
    ...type.small,
    color: color.text.secondary,
  },
  filterTextActive: {
    color: color.accent.ink,
    fontFamily: font.body.semibold,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  loading: {
    marginTop: space.huge,
  },
  card: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
    gap: space.sm,
  },
  cardPressed: {
    backgroundColor: color.bg.elevated,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
  },
  cardName: {
    ...type.heading2,
    color: color.text.primary,
    flex: 1,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs + 2,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: 3,
  },
  typeBadgeText: {
    ...type.micro,
    color: color.text.primary,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  cardMeta: {
    ...type.small,
    color: color.text.secondary,
    marginRight: space.sm,
  },
  cardActions: {
    flexDirection: "row",
    gap: space.sm,
    marginLeft: "auto",
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: color.bg.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  previewList: {
    gap: 2,
  },
  previewItem: {
    ...type.small,
    color: color.text.primary,
  },
  previewMeta: {
    color: color.text.secondary,
  },
  previewMore: {
    ...type.small,
    color: color.text.secondary,
    fontStyle: "italic",
    marginTop: 2,
  },
  empty: {
    paddingTop: space.huge,
  },
  emptyText: {
    ...type.body,
    color: color.text.secondary,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: space.screen,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.accent.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
