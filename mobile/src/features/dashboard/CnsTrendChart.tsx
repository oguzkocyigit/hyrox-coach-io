import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";

import { color, font, space, type } from "@/ui/tokens";

const CHART_HEIGHT = 110;
const PADDING_TOP = 10;
const PADDING_BOTTOM = 6;
const DAY_COUNT = 7;

const DAY_LABELS = ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"];

type DayPoint = {
  label: string;
  score: number;
  isToday: boolean;
};

/** Son 7 gunu (bugun dahil) eski -> yeni sirayla kurar; veri yoksa 0. */
function buildPoints(dailyScores: Record<string, number>): DayPoint[] {
  const points: DayPoint[] = [];
  const now = new Date();
  for (let i = DAY_COUNT - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const iso = day.toISOString().slice(0, 10);
    // getDay(): 0 = Pazar -> etiket dizisinde 6. indeks
    const labelIndex = (day.getDay() + 6) % 7;
    points.push({
      label: DAY_LABELS[labelIndex],
      score: dailyScores[iso] ?? 0,
      isToday: i === 0,
    });
  }
  return points;
}

type CnsTrendChartProps = {
  dailyScores: Record<string, number>;
};

/** 7 gunluk CNS yorgunluk trendi (DESIGN_SYSTEM Bolum 5). */
export function CnsTrendChart({ dailyScores }: CnsTrendChartProps) {
  const [width, setWidth] = useState(0);
  const points = buildPoints(dailyScores);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const maxScore = Math.max(...points.map((p) => p.score), 1);
  const drawableHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const slotWidth = width / DAY_COUNT;

  const coords = points.map((p, i) => ({
    x: slotWidth * i + slotWidth / 2,
    y: PADDING_TOP + drawableHeight * (1 - p.score / maxScore),
  }));

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const today = coords[coords.length - 1];

  return (
    <View onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={CHART_HEIGHT}>
          {/* Yatay izgara: zemin cizgisi */}
          <Line
            x1={0}
            y1={CHART_HEIGHT - PADDING_BOTTOM}
            x2={width}
            y2={CHART_HEIGHT - PADDING_BOTTOM}
            stroke={color.stroke.subtle}
            strokeWidth={1}
          />
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={color.accent.primary}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Bugunun noktasi: halo + dolu daire */}
          <Circle cx={today.x} cy={today.y} r={9} fill={color.accent.subtle} />
          <Circle cx={today.x} cy={today.y} r={4} fill={color.accent.primary} />
        </Svg>
      ) : null}

      <View style={styles.labelsRow}>
        {points.map((p, i) => (
          <View key={i} style={styles.labelSlot}>
            <Text style={[styles.dayLabel, p.isToday && styles.dayLabelToday]}>
              {p.label.toUpperCase()}
            </Text>
            <Text style={[styles.scoreLabel, p.isToday && styles.dayLabelToday]}>
              {p.score > 0 ? p.score.toFixed(1) : "·"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelsRow: {
    flexDirection: "row",
    marginTop: space.xs,
  },
  labelSlot: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  dayLabel: {
    ...type.micro,
    fontSize: 9,
    color: color.text.disabled,
  },
  scoreLabel: {
    fontFamily: font.data.regular,
    fontSize: 10,
    color: color.text.secondary,
  },
  dayLabelToday: {
    color: color.accent.primary,
  },
});
