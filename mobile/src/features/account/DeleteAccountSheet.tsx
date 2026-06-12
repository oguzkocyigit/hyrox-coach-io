import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDeleteAccount } from "@/api/hooks";
import { supabase } from "@/lib/supabase";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";
import { color, radius, space, type } from "@/ui/tokens";

const CONFIRM_WORD = "SIL";

type DeleteAccountSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Hesap silme: geri alinamaz oldugu icin yazarak onay istenir
 * (DESIGN_SYSTEM Bolum 3, kritik UX kurali).
 */
export function DeleteAccountSheet({ visible, onClose }: DeleteAccountSheetProps) {
  const insets = useSafeAreaInsets();
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const deleteAccount = useDeleteAccount();

  const confirmed = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  const close = () => {
    setConfirmText("");
    setError(null);
    onClose();
  };

  const onDelete = () => {
    setError(null);
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        // Backend DB + Supabase Auth kaydini sildi; lokal oturumu kapat.
        // signOut hata verse bile oturum gecersizdir, yoksay.
        void supabase.auth.signOut().catch(() => undefined);
      },
      onError: (e) =>
        setError(e instanceof Error ? e.message : "Hesap silinemedi. Tekrar dene."),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouchable} onPress={close} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.handle} />

          <Text style={styles.title}>Hesabi kalici olarak sil</Text>
          <Text style={styles.body}>
            Tum idmanlarin, metriklerin ve profil bilgilerin geri alinamaz sekilde
            silinecek. Devam etmek icin asagiya{" "}
            <Text style={styles.confirmWord}>{CONFIRM_WORD}</Text> yaz.
          </Text>

          <TextField
            label={`Onay (${CONFIRM_WORD})`}
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Button label="Vazgec" variant="ghost" onPress={close} />
            <View style={styles.deleteButton}>
              <Button
                label="Hesabi Sil"
                variant="destructive"
                onPress={onDelete}
                disabled={!confirmed}
                loading={deleteAccount.isPending}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  backdropTouchable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: color.bg.elevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.screen,
    paddingTop: space.md,
    gap: space.lg,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: color.stroke.strong,
  },
  title: {
    ...type.heading2,
    color: color.text.primary,
  },
  body: {
    ...type.body,
    color: color.text.secondary,
  },
  confirmWord: {
    ...type.bodyStrong,
    color: color.status.danger,
  },
  error: {
    ...type.small,
    color: color.status.danger,
  },
  actions: {
    flexDirection: "row",
    gap: space.md,
    alignItems: "center",
  },
  deleteButton: {
    flex: 1,
  },
});
