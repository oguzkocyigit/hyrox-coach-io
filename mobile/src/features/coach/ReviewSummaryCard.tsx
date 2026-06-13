/**
 * Pazar degerlendirmesi AI ciktisi — haftalik ozet karti.
 */

import { StyleSheet, Text, View } from "react-native";

import type { SundayReviewResponse } from "@/api/types";
import { color, font, radius, space, type } from "@/ui/tokens";

type ReviewSummaryCardProps = {
  review: SundayReviewResponse;
};

function readinessLabel(score: number): string {
  if (score <= 3) return "Dinlenme / deload onerilir";
  if (score <= 6) return "Orta tempoda devam";
  if (score <= 8) return "Iyi form — kontrollu yukle";
  return "Prime form — saldiri haftasi";
}

function readinessColor(score: number): string {
  if (score <= 3) return color.status.danger;
  if (score <= 6) return color.status.caution;
  if (score <= 8) return color.status.info;
  return color.status.safe;
}

export function ReviewSummaryCard({ review }: ReviewSummaryCardProps) {
  const readinessTint = readinessColor(review.readiness_score);

  return (
    <View style={styles.card}>
      <View style={styles.scoreRow}>
        <View>
          <Text style={styles.scoreLabel}>HAFTAYA HAZIRLIK</Text>
          <Text style={[styles.scoreValue, { color: readinessTint }]}>
            {review.readiness_score}
            <Text style={styles.scoreMax}>/10</Text>
          </Text>
        </View>
        <View style={[styles.scoreBadge, { borderColor: readinessTint }]}>
          <Text style={[styles.scoreBadgeText, { color: readinessTint }]}>
            {readinessLabel(review.readiness_score)}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>HAFTALIK DEGERLENDIRME</Text>
        <Text style={styles.bodyText}>{review.review_summary}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>GELECEK HAFTA TAKTIKLERI</Text>
        <Text style={styles.bodyText}>{review.next_week_adjustments}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.accent.primary,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.lg,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
  },
  scoreLabel: {
    ...type.micro,
    color: color.text.secondary,
  },
  scoreValue: {
    fontFamily: font.display.bold,
    fontSize: 40,
    lineHeight: 44,
    marginTop: space.xs,
  },
  scoreMax: {
    fontFamily: font.body.regular,
    fontSize: 18,
    color: color.text.secondary,
  },
  scoreBadge: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: color.bg.elevated,
  },
  scoreBadgeText: {
    ...type.small,
    fontFamily: font.body.semibold,
    textAlign: "right",
  },
  section: {
    gap: space.sm,
  },
  sectionLabel: {
    ...type.micro,
    color: color.accent.primary,
  },
  bodyText: {
    ...type.body,
    color: color.text.primary,
    lineHeight: 22,
  },
});
