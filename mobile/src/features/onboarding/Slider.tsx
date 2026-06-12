/**
 * VOLT kaydirici. PanResponder tabanli: ek native modul gerektirmez,
 * dolayisiyla dev client'i yeniden derletmez. Deger etiketi ustte,
 * min/max etiketleri altta gosterilir.
 */

import { useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";

import { color, radius, space, type } from "@/ui/tokens";

type SliderProps = {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  /** Buyuk deger etiketi (orn. "5:30 /km" veya "4 gun") */
  formatValue: (value: number) => string;
  minLabel?: string;
  maxLabel?: string;
};

export function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
  formatValue,
  minLabel,
  maxLabel,
}: SliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);

  // PanResponder bir kez kurulur; guncel degerlere ref ile erisir.
  const stateRef = useRef({ trackWidth: 0, grantValue: value, onChange });
  stateRef.current.trackWidth = trackWidth;
  stateRef.current.onChange = onChange;

  const clampToStep = (raw: number) => {
    const stepped = Math.round((raw - min) / step) * step + min;
    return Math.min(max, Math.max(min, stepped));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const width = stateRef.current.trackWidth;
        if (width <= 0) return;
        const ratio = evt.nativeEvent.locationX / width;
        const next = clampToStep(min + ratio * (max - min));
        stateRef.current.grantValue = next;
        stateRef.current.onChange(next);
      },
      onPanResponderMove: (_evt, gesture) => {
        const width = stateRef.current.trackWidth;
        if (width <= 0) return;
        const delta = (gesture.dx / width) * (max - min);
        stateRef.current.onChange(clampToStep(stateRef.current.grantValue + delta));
      },
    }),
  ).current;

  const ratio = max > min ? (value - min) / (max - min) : 0;
  const thumbLeft = Math.max(0, ratio * trackWidth - THUMB_SIZE / 2);

  return (
    <View style={styles.container}>
      <Text style={styles.valueLabel}>{formatValue(value)}</Text>

      <View
        style={styles.touchArea}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: ratio * trackWidth }]} />
        </View>
        <View style={[styles.thumb, { left: thumbLeft }]} />
      </View>

      {minLabel || maxLabel ? (
        <View style={styles.bounds}>
          <Text style={styles.boundText}>{minLabel ?? ""}</Text>
          <Text style={styles.boundText}>{maxLabel ?? ""}</Text>
        </View>
      ) : null}
    </View>
  );
}

const THUMB_SIZE = 28;

const styles = StyleSheet.create({
  container: {
    gap: space.sm,
  },
  valueLabel: {
    ...type.displayLg,
    color: color.accent.primary,
    textAlign: "center",
    marginBottom: space.sm,
  },
  touchArea: {
    height: 44,
    justifyContent: "center",
  },
  track: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: color.bg.elevated,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: color.accent.primary,
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: color.text.primary,
    borderWidth: 3,
    borderColor: color.accent.primary,
  },
  bounds: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  boundText: {
    ...type.micro,
    color: color.text.secondary,
  },
});
