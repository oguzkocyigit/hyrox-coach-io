/**
 * Profil > Hesap segmentindeki Apple Health senkron karti.
 * Anahtar ile ac/kapat, manuel "Simdi Senkronla" ve son senkron bilgisi.
 */

import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { useHealthSyncController } from "@/features/health-sync/useHealthSync";
import { color, font, radius, space, type } from "@/ui/tokens";

function formatSyncTime(date: Date | null): string {
  if (!date) return "Henuz senkronlanmadi";
  return `Son senkron: ${date.toLocaleDateString("tr-TR")} ${date.toLocaleTimeString(
    "tr-TR",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

export function HealthSyncCard() {
  const sync = useHealthSyncController();

  if (sync.loading) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconBox}>
          <Ionicons name="heart" size={18} color={color.accent.primary} />
        </View>
        <View style={styles.headerTexts}>
          <Text style={styles.title}>Apple Health</Text>
          <Text style={styles.subtitle}>
            {sync.supported
              ? "Kosu ve kurek antrenmanlarini otomatik aktar"
              : "Bu cihazda kullanilamiyor (dev build gerekli)"}
          </Text>
        </View>
        <Switch
          value={sync.enabled}
          disabled={!sync.supported || sync.syncing}
          onValueChange={(value) => void sync.setEnabled(value)}
          trackColor={{
            false: color.bg.elevated,
            true: color.accent.primary,
          }}
          thumbColor={color.text.primary}
        />
      </View>

      {sync.enabled ? (
        <View style={styles.footer}>
          <Text style={styles.meta}>
            {sync.syncing ? "Senkronlaniyor..." : formatSyncTime(sync.lastSyncAt)}
          </Text>
          {sync.lastResult ? (
            <Text style={styles.meta}>
              {sync.lastResult.imported} yeni idman aktarildi
              {sync.lastResult.skippedDuplicates > 0
                ? ` (${sync.lastResult.skippedDuplicates} zaten kayitliydi)`
                : ""}
            </Text>
          ) : null}
          <Pressable
            onPress={() => void sync.syncNow()}
            disabled={sync.syncing}
            style={({ pressed }) => [
              styles.syncButton,
              (pressed || sync.syncing) && styles.syncButtonPressed,
            ]}
          >
            <Ionicons name="refresh" size={15} color={color.accent.primary} />
            <Text style={styles.syncButtonText}>Simdi Senkronla</Text>
          </Pressable>
        </View>
      ) : null}

      {sync.error ? <Text style={styles.error}>{sync.error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: color.bg.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTexts: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.bodyStrong,
    color: color.text.primary,
  },
  subtitle: {
    ...type.small,
    color: color.text.secondary,
  },
  footer: {
    gap: space.sm,
  },
  meta: {
    ...type.small,
    color: color.text.secondary,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.sm,
    paddingVertical: space.sm + 2,
    marginTop: space.xs,
  },
  syncButtonPressed: {
    opacity: 0.6,
  },
  syncButtonText: {
    ...type.small,
    color: color.accent.primary,
    fontFamily: font.body.semibold,
  },
  error: {
    ...type.small,
    color: color.status.danger,
  },
});
