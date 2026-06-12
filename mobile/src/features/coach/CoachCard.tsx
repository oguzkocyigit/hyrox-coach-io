/**
 * Dashboard'daki AI Koc karti (MOBILE_BLUEPRINT: Faz 3).
 *
 * - free: uc hic cagrilmaz; paywall'a yonlendiren kilitli kart gosterilir.
 * - premium/pro: istek uzerine haftalik koc notu uretilir.
 * - 429: paywall DEGIL, sakin "kota doldu" mesaji (backend detail'i gosterilir).
 * - 503: AI servisi yapilandirilmamis bilgisi.
 */

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useMe, useWeeklyAnalysis } from "@/api/hooks";
import { ApiError } from "@/api/client";
import { Button } from "@/ui/Button";
import { color, font, radius, space, type } from "@/ui/tokens";

const TIER_QUOTA_LABEL: Record<string, string> = {
  premium: "Haftada 1 analiz hakkin var",
  pro: "Gunde 5 analiz hakkin var",
};

function errorView(error: unknown): { calm: boolean; message: string } {
  if (error instanceof ApiError) {
    if (error.status === 429) return { calm: true, message: error.message };
    if (error.status === 503) {
      return {
        calm: true,
        message: "AI koc servisi su an aktif degil. Daha sonra tekrar dene.",
      };
    }
    return { calm: false, message: error.message };
  }
  return { calm: false, message: "Analiz alinamadi. Baglantini kontrol et." };
}

export function CoachCard() {
  const { data: me } = useMe();
  const analysis = useWeeklyAnalysis();

  if (!me) return null;

  // --- Free: kilitli kart + paywall CTA ---
  if (me.tier === "free") {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconBox}>
            <Ionicons name="sparkles" size={16} color={color.accent.primary} />
          </View>
          <Text style={styles.title}>AI KOC</Text>
          <Ionicons name="lock-closed" size={14} color={color.text.secondary} />
        </View>
        <Text style={styles.body}>
          Haftalik verilerini yapay zeka koc yorumlasin: asiri yuklenme,
          toparlanma ve gelecek hafta onerileri.
        </Text>
        <Button label="Premium'a Gec" onPress={() => router.push("/paywall")} />
      </View>
    );
  }

  // --- Premium / Pro ---
  const note = analysis.data?.analysis;
  const err = analysis.isError ? errorView(analysis.error) : null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconBox}>
          <Ionicons name="sparkles" size={16} color={color.accent.primary} />
        </View>
        <Text style={styles.title}>AI KOC</Text>
        <Text style={styles.quota}>{TIER_QUOTA_LABEL[me.tier] ?? ""}</Text>
      </View>

      {note ? (
        <View style={styles.noteBox}>
          {note.breach_detected ? (
            <View style={styles.breachRow}>
              <Ionicons name="warning" size={14} color={color.status.danger} />
              <Text style={styles.breachText}>Asiri yuklenme tespit edildi</Text>
            </View>
          ) : null}
          <Text style={styles.noteText}>{note.coaches_note}</Text>
        </View>
      ) : null}

      {err ? (
        <View style={[styles.infoBox, !err.calm && styles.infoBoxError]}>
          <Ionicons
            name={err.calm ? "time-outline" : "alert-circle-outline"}
            size={15}
            color={err.calm ? color.text.secondary : color.status.danger}
          />
          <Text style={[styles.infoText, !err.calm && styles.infoTextError]}>
            {err.message}
          </Text>
        </View>
      ) : null}

      {note ? (
        <Pressable
          onPress={() => analysis.mutate()}
          disabled={analysis.isPending}
          style={({ pressed }) => [styles.refreshRow, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="refresh" size={14} color={color.accent.primary} />
          <Text style={styles.refreshText}>Yeni analiz al</Text>
        </Pressable>
      ) : (
        <Button
          label={analysis.isPending ? "Analiz hazirlaniyor..." : "Haftalik Analizi Al"}
          onPress={() => analysis.mutate()}
          loading={analysis.isPending}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: color.bg.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...type.micro,
    color: color.text.secondary,
    flex: 1,
  },
  quota: {
    ...type.micro,
    color: color.text.disabled,
  },
  body: {
    ...type.body,
    color: color.text.secondary,
  },
  noteBox: {
    backgroundColor: color.bg.elevated,
    borderRadius: radius.sm,
    padding: space.md,
    gap: space.sm,
  },
  breachRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  breachText: {
    ...type.small,
    color: color.status.danger,
    fontFamily: font.body.semibold,
  },
  noteText: {
    ...type.body,
    color: color.text.primary,
    lineHeight: 22,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    backgroundColor: color.bg.elevated,
    borderRadius: radius.sm,
    padding: space.md,
  },
  infoBoxError: {
    borderWidth: 1,
    borderColor: color.status.danger,
  },
  infoText: {
    ...type.small,
    color: color.text.secondary,
    flex: 1,
  },
  infoTextError: {
    color: color.status.danger,
  },
  refreshRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    paddingVertical: space.sm,
  },
  refreshText: {
    ...type.small,
    color: color.accent.primary,
    fontFamily: font.body.semibold,
  },
});
