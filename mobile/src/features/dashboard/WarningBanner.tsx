import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { color, radius, space, type } from "@/ui/tokens";

type WarningBannerProps = {
  muscles: string[];
};

/** Overtraining uyari bandi: yalnizca esik asildiginda gorunur. */
export function WarningBanner({ muscles }: WarningBannerProps) {
  if (muscles.length === 0) return null;

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Ionicons name="warning" size={18} color={color.status.danger} />
      <View style={styles.texts}>
        <Text style={styles.title}>OVERTRAINING RISKI</Text>
        <Text style={styles.body}>
          {muscles.join(", ")} esigi asti. Bu hafta bu bolgelerde hacmi dusur.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: space.md,
    backgroundColor: color.status.dangerSubtle,
    borderWidth: 1,
    borderColor: color.status.danger,
    borderRadius: radius.md,
    padding: space.md,
    alignItems: "flex-start",
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.micro,
    color: color.status.danger,
  },
  body: {
    ...type.bodyStrong,
    color: color.text.primary,
  },
});
