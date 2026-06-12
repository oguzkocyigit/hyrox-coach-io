/**
 * Paywall (modal): Premium / Pro plan karsilastirmasi.
 *
 * Satin alma RevenueCat ile baglanacak (App Store hesabi gerektirir);
 * o zamana kadar CTA'lar bilgilendirme gosterir. Backend webhook'u
 * (POST /webhooks/revenuecat) hazir oldugundan baglanti tek adimdir.
 */

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMe } from "@/api/hooks";
import { Button } from "@/ui/Button";
import { color, font, radius, space, type } from "@/ui/tokens";

type Plan = {
  id: "premium" | "pro";
  name: string;
  tagline: string;
  features: string[];
  highlighted: boolean;
};

const PLANS: Plan[] = [
  {
    id: "premium",
    name: "PREMIUM",
    tagline: "Haftalik AI koc analizi",
    features: [
      "Haftada 1 AI koc notu",
      "Asiri yuklenme yorumu ve toparlanma onerisi",
      "Tum deterministik metrikler (CNS, kas yuku)",
      "Wearable senkronu",
    ],
    highlighted: false,
  },
  {
    id: "pro",
    name: "PRO",
    tagline: "Elit atletler icin tam erisim",
    features: [
      "Gunde 5 AI koc analizi",
      "Premium'daki her sey",
      "Programatik adaptasyon (yakinda)",
      "Yeni ozelliklere oncelikli erisim",
    ],
    highlighted: true,
  },
];

function notifyComingSoon() {
  Alert.alert(
    "Yakinda",
    "Abonelikler App Store baglantisi tamamlandiginda aktif olacak.",
  );
}

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>HYROX COACH</Text>
          <Text style={styles.title}>Performansini Yukselt</Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeButton}>
          <Ionicons name="close" size={22} color={color.text.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + space.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Deterministik motor verini hesaplar; AI koc senin icin yorumlar.
        </Text>

        {PLANS.map((plan) => {
          const isCurrent = me?.tier === plan.id;
          return (
            <View
              key={plan.id}
              style={[styles.planCard, plan.highlighted && styles.planCardHighlighted]}
            >
              <View style={styles.planHeader}>
                <Text
                  style={[
                    styles.planName,
                    plan.highlighted && styles.planNameHighlighted,
                  ]}
                >
                  {plan.name}
                </Text>
                {plan.highlighted ? (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>POPULER</Text>
                  </View>
                ) : null}
                {isCurrent ? (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentText}>MEVCUT PLAN</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.planTagline}>{plan.tagline}</Text>

              <View style={styles.features}>
                {plan.features.map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={
                        plan.highlighted ? color.accent.primary : color.text.secondary
                      }
                    />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <Button
                label={isCurrent ? "Aktif" : `${plan.name} Planina Gec`}
                variant={plan.highlighted ? "primary" : "secondary"}
                disabled={isCurrent}
                onPress={notifyComingSoon}
              />
            </View>
          );
        })}

        <Text style={styles.footnote}>
          Abonelikler App Store uzerinden yonetilir ve istedigin an iptal
          edilebilir. Satin alma entegrasyonu yakinda aktif olacak.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg.base,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: space.xl,
    marginBottom: space.lg,
  },
  brand: {
    ...type.micro,
    color: color.accent.primary,
  },
  title: {
    ...type.displayLg,
    color: color.text.primary,
    marginTop: space.xs,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: color.bg.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  subtitle: {
    ...type.body,
    color: color.text.secondary,
  },
  planCard: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  planCardHighlighted: {
    borderColor: color.accent.primary,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  planName: {
    fontFamily: font.display.bold,
    fontSize: 20,
    color: color.text.primary,
    letterSpacing: 1,
  },
  planNameHighlighted: {
    color: color.accent.primary,
  },
  popularBadge: {
    backgroundColor: color.accent.primary,
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  popularText: {
    ...type.micro,
    color: color.accent.ink,
  },
  currentBadge: {
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  currentText: {
    ...type.micro,
    color: color.text.secondary,
  },
  planTagline: {
    ...type.body,
    color: color.text.secondary,
  },
  features: {
    gap: space.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  featureText: {
    ...type.body,
    color: color.text.primary,
    flex: 1,
  },
  footnote: {
    ...type.small,
    color: color.text.disabled,
    textAlign: "center",
  },
});
