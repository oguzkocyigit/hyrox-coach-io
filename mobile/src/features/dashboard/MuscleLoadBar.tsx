import { StyleSheet, Text, View } from "react-native";

import { chart, color, loadColor, radius, space, type } from "@/ui/tokens";

type MuscleLoadBarProps = {
  muscle: string;
  load: number;
};

/** Imza bilesen: 22 esik cizgili haftalik kas yuku bari (DESIGN_SYSTEM Bolum 5). */
export function MuscleLoadBar({ muscle, load }: MuscleLoadBarProps) {
  const fillColor = loadColor(load);
  const fillPercent = Math.min(100, (load / chart.muscleBarMax) * 100);
  const thresholdPercent = (chart.muscleThreshold / chart.muscleBarMax) * 100;
  const overThreshold = load > chart.muscleThreshold;

  return (
    <View
      style={styles.container}
      accessibilityLabel={`${muscle}, haftalik yuk ${load.toFixed(1)}, esik ${
        chart.muscleThreshold
      }${overThreshold ? "'nin uzerinde" : "'nin altinda"}`}
    >
      <View style={styles.labels}>
        <Text style={styles.muscle}>{muscle}</Text>
        <Text style={[styles.value, { color: fillColor }]}>{load.toFixed(1)}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${fillPercent}%`, backgroundColor: fillColor }]}
        />
        <View style={[styles.threshold, { left: `${thresholdPercent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.xs,
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  muscle: {
    ...type.micro,
    color: color.text.primary,
  },
  value: {
    ...type.micro,
  },
  track: {
    height: 10,
    backgroundColor: color.bg.base,
    borderRadius: radius.sm,
  },
  fill: {
    height: "100%",
    borderRadius: radius.sm,
  },
  threshold: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 2,
    backgroundColor: color.text.primary,
    opacity: 0.5,
  },
});
