import type { ReactElement, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, space } from "@/ui/tokens";

type ScreenProps = {
  children: ReactNode;
  /** Varsayilan true: icerik ScrollView icinde akar */
  scroll?: boolean;
  /** Asagi cekip yenileme (yalnizca scroll modunda) */
  refreshControl?: ReactElement<RefreshControlProps>;
};

/** Tum ekranlarin ortak zemini: asfalt arka plan + guvenli alan + klavye uyumu. */
export function Screen({ children, scroll = true, refreshControl }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + space.md,
    paddingBottom: insets.bottom + space.xl,
    paddingHorizontal: space.screen,
  };

  if (!scroll) {
    return <View style={[styles.root, padding]}>{children}</View>;
  }
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, padding]}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg.base,
  },
  content: {
    flexGrow: 1,
  },
});
