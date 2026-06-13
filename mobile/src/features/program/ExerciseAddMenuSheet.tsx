/**
 * Egzersiz ekleme yontemi secimi: katalog, ozel veya AI.
 */

import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, radius, space, type } from "@/ui/tokens";

type ExerciseAddMenuSheetProps = {
  visible: boolean;
  onClose: () => void;
  onPickCatalog: () => void;
  onPickCustom: () => void;
  onPickAI: () => void;
};

type MenuItem = {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accent?: boolean;
};

export function ExerciseAddMenuSheet({
  visible,
  onClose,
  onPickCatalog,
  onPickCustom,
  onPickAI,
}: ExerciseAddMenuSheetProps) {
  const insets = useSafeAreaInsets();

  const items: MenuItem[] = [
    {
      id: "ai",
      label: "AI Secsin",
      description: "Onceki hareket ve haftalik programa gore onerir",
      icon: "sparkles",
      onPress: onPickAI,
      accent: true,
    },
    {
      id: "catalog",
      label: "Katalogdan Sec",
      description: "Egzersiz listesinden ara ve sec",
      icon: "library-outline",
      onPress: onPickCatalog,
    },
    {
      id: "custom",
      label: "Ozel Olustur",
      description: "Listede yoksa kendi hareketini yaz",
      icon: "create-outline",
      onPress: onPickCustom,
    },
  ];

  const handlePress = (item: MenuItem) => {
    onClose();
    item.onPress();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Kapat">
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={styles.title}>Egzersiz Ekle</Text>
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handlePress(item)}
              style={({ pressed }) => [
                styles.row,
                item.accent && styles.rowAccent,
                pressed && styles.rowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={[styles.iconBox, item.accent && styles.iconBoxAccent]}>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.accent ? color.accent.primary : color.text.secondary}
                />
              </View>
              <View style={styles.texts}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowDesc}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={color.text.disabled} />
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: color.bg.elevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.screen,
    paddingTop: space.xl,
    gap: space.sm,
  },
  title: {
    ...type.heading2,
    color: color.text.primary,
    marginBottom: space.sm,
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
  },
  rowAccent: {
    borderColor: color.accent.primary,
    backgroundColor: color.accent.subtle,
  },
  rowPressed: {
    opacity: 0.85,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: color.bg.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxAccent: {
    backgroundColor: color.bg.surface,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...type.bodyStrong,
    color: color.text.primary,
  },
  rowDesc: {
    ...type.small,
    color: color.text.secondary,
  },
});
