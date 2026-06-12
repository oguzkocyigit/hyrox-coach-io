import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, View, type ColorValue } from "react-native";

import { useAutoHealthSync } from "@/features/health-sync/useHealthSync";
import { color, font } from "@/ui/tokens";

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: IconName) {
  return ({ color: iconColor }: { color: ColorValue }) => (
    <Ionicons name={name} size={22} color={iconColor as string} />
  );
}

/** Orta sekme: yukseltilmis volt kaydet butonu (tek kalici accent dolgusu). */
function LogTabIcon() {
  return (
    <View style={styles.logButton}>
      <Ionicons name="add" size={30} color={color.accent.ink} />
    </View>
  );
}

export default function TabsLayout() {
  // Acilis + foreground'a donuste Apple Health senkronu (etkinse)
  useAutoHealthSync();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.accent.primary,
        tabBarInactiveTintColor: color.text.secondary,
        tabBarStyle: {
          backgroundColor: color.bg.surface,
          borderTopColor: color.stroke.subtle,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: {
          fontFamily: font.body.medium,
          fontSize: 10,
        },
        sceneStyle: { backgroundColor: color.bg.base },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Dashboard", tabBarIcon: tabIcon("speedometer-outline") }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: "Gecmis", tabBarIcon: tabIcon("list-outline") }}
      />
      <Tabs.Screen
        name="log"
        options={{ title: "", tabBarIcon: LogTabIcon }}
      />
      <Tabs.Screen
        name="program"
        options={{ title: "Program", tabBarIcon: tabIcon("calendar-outline") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profil", tabBarIcon: tabIcon("person-outline") }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  logButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: color.accent.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -18,
  },
});
