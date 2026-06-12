/**
 * Profil ekrani (RoxHype gorsel dili): Kisisel / Hesap segmentleri.
 * - Kisisel: ad, yas, cinsiyet, boy, kilo (duzenle modu ile PATCH /users/me)
 * - Hesap: uyelik, cikis, tehlikeli bolge (hesap silme), surum bilgisi
 */

import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useMe, useUpdateProfile } from "@/api/hooks";
import type { Gender } from "@/api/types";
import { DeleteAccountSheet } from "@/features/account/DeleteAccountSheet";
import { HealthSyncCard } from "@/features/health-sync/HealthSyncCard";
import { supabase } from "@/lib/supabase";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { TextField } from "@/ui/TextField";
import { color, font, radius, space, type } from "@/ui/tokens";

const TIER_LABELS: Record<string, string> = {
  free: "FREE",
  premium: "PREMIUM",
  pro: "PRO",
};

const GENDERS: { id: Gender; label: string }[] = [
  { id: "male", label: "Erkek" },
  { id: "female", label: "Kadin" },
  { id: "other", label: "Diger" },
];

type Section = "personal" | "account";

type PersonalDraft = {
  fullName: string;
  age: string;
  gender: Gender | null;
  heightCm: string;
  weightKg: string;
};

export default function ProfileScreen() {
  const { data: me } = useMe();
  const updateProfile = useUpdateProfile();

  const [section, setSection] = useState<Section>("personal");
  const [editing, setEditing] = useState(false);
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [draft, setDraft] = useState<PersonalDraft>({
    fullName: "",
    age: "",
    gender: null,
    heightCm: "",
    weightKg: "",
  });
  const [saveError, setSaveError] = useState<string | null>(null);

  // Profil yuklendiginde / duzenleme acildiginde draft'i doldur
  useEffect(() => {
    if (me && !editing) {
      setDraft({
        fullName: me.full_name ?? "",
        age: me.age != null ? String(me.age) : "",
        gender: me.gender,
        heightCm: me.height_cm != null ? String(me.height_cm) : "",
        weightKg: me.weight_kg != null ? String(me.weight_kg) : "",
      });
    }
  }, [me, editing]);

  const handleSave = async () => {
    setSaveError(null);
    const age = draft.age.trim() ? Number.parseInt(draft.age, 10) : null;
    const heightCm = draft.heightCm.trim()
      ? Number.parseInt(draft.heightCm, 10)
      : null;
    const weightKg = draft.weightKg.trim()
      ? Number.parseFloat(draft.weightKg.replace(",", "."))
      : null;

    try {
      await updateProfile.mutateAsync({
        full_name: draft.fullName.trim() || null,
        age,
        gender: draft.gender,
        height_cm: heightCm,
        weight_kg: weightKg,
      });
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Kaydedilemedi.");
    }
  };

  const memberSince = me?.created_at
    ? new Date(me.created_at).toLocaleDateString("tr-TR")
    : "—";
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <Screen>
      <View style={styles.container}>
        {/* Segment kontrol */}
        <View style={styles.segments}>
          <Pressable
            onPress={() => setSection("personal")}
            style={[styles.segment, section === "personal" && styles.segmentActive]}
          >
            <Ionicons
              name="person-outline"
              size={15}
              color={section === "personal" ? color.accent.ink : color.text.secondary}
            />
            <Text
              style={[
                styles.segmentText,
                section === "personal" && styles.segmentTextActive,
              ]}
            >
              Kisisel
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSection("account")}
            style={[styles.segment, section === "account" && styles.segmentActive]}
          >
            <Ionicons
              name="settings-outline"
              size={15}
              color={section === "account" ? color.accent.ink : color.text.secondary}
            />
            <Text
              style={[
                styles.segmentText,
                section === "account" && styles.segmentTextActive,
              ]}
            >
              Hesap
            </Text>
          </Pressable>
        </View>

        {section === "personal" ? (
          <>
            {/* Duzenle butonu */}
            <View style={styles.editRow}>
              {editing ? (
                <Pressable
                  onPress={() => setEditing(false)}
                  hitSlop={8}
                  style={styles.editButton}
                >
                  <Text style={styles.editButtonTextMuted}>Vazgec</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setEditing(true)}
                  hitSlop={8}
                  style={styles.editButton}
                >
                  <Ionicons name="create-outline" size={15} color={color.accent.primary} />
                  <Text style={styles.editButtonText}>Duzenle</Text>
                </Pressable>
              )}
            </View>

            {/* Kisisel bilgiler karti */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="person" size={16} color={color.accent.primary} />
                <Text style={styles.cardTitle}>Kisisel Bilgiler</Text>
              </View>

              {editing ? (
                <View style={styles.form}>
                  <TextField
                    label="Ad Soyad"
                    value={draft.fullName}
                    onChangeText={(fullName) => setDraft((d) => ({ ...d, fullName }))}
                    autoCapitalize="words"
                  />
                  <View style={styles.fieldRow}>
                    <View style={styles.fieldHalf}>
                      <TextField
                        label="Yas"
                        value={draft.age}
                        onChangeText={(age) => setDraft((d) => ({ ...d, age }))}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.fieldHalf}>
                      <TextField
                        label="Boy (cm)"
                        value={draft.heightCm}
                        onChangeText={(heightCm) => setDraft((d) => ({ ...d, heightCm }))}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                  <View style={styles.fieldRow}>
                    <View style={styles.fieldHalf}>
                      <TextField
                        label="Kilo (kg)"
                        value={draft.weightKg}
                        onChangeText={(weightKg) => setDraft((d) => ({ ...d, weightKg }))}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.fieldHalf}>
                      <Text style={styles.fieldLabel}>CINSIYET</Text>
                      <View style={styles.genderRow}>
                        {GENDERS.map((g) => {
                          const active = draft.gender === g.id;
                          return (
                            <Pressable
                              key={g.id}
                              onPress={() =>
                                setDraft((d) => ({
                                  ...d,
                                  gender: active ? null : g.id,
                                }))
                              }
                              style={[
                                styles.genderPill,
                                active && styles.genderPillActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.genderText,
                                  active && styles.genderTextActive,
                                ]}
                              >
                                {g.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

                  <Button
                    label="Kaydet"
                    onPress={() => void handleSave()}
                    loading={updateProfile.isPending}
                  />
                </View>
              ) : (
                <View style={styles.infoGrid}>
                  <InfoField label="Ad Soyad" value={me?.full_name ?? "—"} />
                  <InfoField label="E-posta" value={me?.email ?? "—"} />
                  <View style={styles.fieldRow}>
                    <InfoField
                      label="Yas"
                      value={me?.age != null ? String(me.age) : "—"}
                      half
                    />
                    <InfoField
                      label="Cinsiyet"
                      value={
                        GENDERS.find((g) => g.id === me?.gender)?.label ?? "—"
                      }
                      half
                    />
                  </View>
                  <View style={styles.fieldRow}>
                    <InfoField
                      label="Boy (cm)"
                      value={me?.height_cm != null ? String(me.height_cm) : "—"}
                      half
                    />
                    <InfoField
                      label="Kilo (kg)"
                      value={me?.weight_kg != null ? String(me.weight_kg) : "—"}
                      half
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Ek detaylar */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons
                  name="information-circle"
                  size={16}
                  color={color.accent.primary}
                />
                <Text style={styles.cardTitle}>Ek Detaylar</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Uyelik Tarihi</Text>
                <Text style={styles.detailValue}>{memberSince}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Uyelik Seviyesi</Text>
                <View
                  style={[
                    styles.tierBadge,
                    me?.tier === "pro" && styles.tierBadgePro,
                  ]}
                >
                  <Text
                    style={[
                      styles.tierText,
                      me?.tier === "pro" && styles.tierTextPro,
                    ]}
                  >
                    {me ? TIER_LABELS[me.tier] : "—"}
                  </Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Wearable senkron */}
            <Text style={styles.groupLabel}>SENKRON</Text>
            <HealthSyncCard />

            {/* Hesap islemleri */}
            <Text style={styles.groupLabel}>HESAP</Text>
            {me?.tier !== "pro" ? (
              <ActionRow
                icon="rocket-outline"
                title="Plani Yukselt"
                subtitle="Premium ve Pro secenekleri"
                onPress={() => router.push("/paywall")}
              />
            ) : null}
            <ActionRow
              icon="log-out-outline"
              title="Cikis Yap"
              subtitle="Oturumu kapat"
              onPress={() => void supabase.auth.signOut()}
            />

            {/* Tehlikeli bolge */}
            <View style={styles.dangerZone}>
              <View style={styles.dangerHeader}>
                <Ionicons name="warning" size={16} color={color.status.danger} />
                <Text style={styles.dangerTitle}>Tehlikeli Bolge</Text>
              </View>
              <Pressable
                onPress={() => setDeleteSheetVisible(true)}
                style={({ pressed }) => [
                  styles.dangerRow,
                  pressed && styles.dangerRowPressed,
                ]}
              >
                <View style={styles.dangerIconBox}>
                  <Ionicons
                    name="person-remove-outline"
                    size={18}
                    color={color.status.danger}
                  />
                </View>
                <View style={styles.actionTexts}>
                  <Text style={styles.dangerRowTitle}>Hesabi Sil</Text>
                  <Text style={styles.dangerRowSubtitle}>
                    Hesabini ve tum verilerini kalici olarak sil.
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={color.status.danger}
                />
              </Pressable>
            </View>

            {/* Surum bilgisi */}
            <View style={styles.versionBox}>
              <Text style={styles.versionTitle}>HYROX COACH v{appVersion}</Text>
              <Text style={styles.versionMeta}>
                Hibrit atletler icin yapildi
              </Text>
            </View>
          </>
        )}
      </View>

      <DeleteAccountSheet
        visible={deleteSheetVisible}
        onClose={() => setDeleteSheetVisible(false)}
      />
    </Screen>
  );
}

function InfoField({
  label,
  value,
  half = false,
}: {
  label: string;
  value: string;
  half?: boolean;
}) {
  return (
    <View style={[infoStyles.field, half && infoStyles.fieldHalf]}>
      <Text style={infoStyles.label}>{label}</Text>
      <View style={infoStyles.valueBox}>
        <Text style={infoStyles.value} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
    >
      <View style={styles.actionIconBox}>
        <Ionicons name={icon} size={18} color={color.text.primary} />
      </View>
      <View style={styles.actionTexts}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color.text.secondary} />
    </Pressable>
  );
}

const infoStyles = StyleSheet.create({
  field: {
    gap: space.xs + 2,
  },
  fieldHalf: {
    flex: 1,
  },
  label: {
    ...type.micro,
    color: color.text.secondary,
  },
  valueBox: {
    backgroundColor: color.bg.elevated,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  value: {
    ...type.body,
    color: color.text.primary,
  },
});

const styles = StyleSheet.create({
  container: {
    gap: space.lg,
  },
  segments: {
    flexDirection: "row",
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.full,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs + 2,
    borderRadius: radius.full,
    paddingVertical: space.sm + 2,
  },
  segmentActive: {
    backgroundColor: color.accent.primary,
  },
  segmentText: {
    ...type.small,
    color: color.text.secondary,
  },
  segmentTextActive: {
    color: color.accent.ink,
    fontFamily: font.body.semibold,
  },
  editRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  editButtonText: {
    ...type.bodyStrong,
    color: color.accent.primary,
  },
  editButtonTextMuted: {
    ...type.bodyStrong,
    color: color.text.secondary,
  },
  card: {
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  cardTitle: {
    ...type.heading2,
    color: color.text.primary,
  },
  form: {
    gap: space.lg,
  },
  infoGrid: {
    gap: space.md,
  },
  fieldRow: {
    flexDirection: "row",
    gap: space.md,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    ...type.micro,
    color: color.text.secondary,
    marginBottom: space.xs + 2,
  },
  genderRow: {
    flexDirection: "row",
    gap: space.xs,
  },
  genderPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.sm,
    paddingVertical: space.md,
    alignItems: "center",
  },
  genderPillActive: {
    backgroundColor: color.accent.primary,
    borderColor: color.accent.primary,
  },
  genderText: {
    ...type.small,
    color: color.text.secondary,
  },
  genderTextActive: {
    color: color.accent.ink,
    fontFamily: font.body.semibold,
  },
  error: {
    ...type.small,
    color: color.status.danger,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailLabel: {
    ...type.body,
    color: color.text.secondary,
  },
  detailValue: {
    ...type.bodyStrong,
    color: color.text.primary,
  },
  tierBadge: {
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  tierBadgePro: {
    backgroundColor: color.accent.primary,
    borderColor: color.accent.primary,
  },
  tierText: {
    ...type.micro,
    color: color.text.secondary,
  },
  tierTextPro: {
    color: color.accent.ink,
  },
  groupLabel: {
    ...type.micro,
    color: color.text.secondary,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  actionRowPressed: {
    backgroundColor: color.bg.elevated,
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: color.bg.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTexts: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    ...type.bodyStrong,
    color: color.text.primary,
  },
  actionSubtitle: {
    ...type.small,
    color: color.text.secondary,
  },
  dangerZone: {
    borderWidth: 1,
    borderColor: color.status.danger,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    marginTop: space.md,
  },
  dangerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  dangerTitle: {
    ...type.heading2,
    color: color.status.danger,
  },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: color.status.dangerSubtle,
    borderWidth: 1,
    borderColor: color.status.danger,
    borderRadius: radius.md,
    padding: space.md,
  },
  dangerRowPressed: {
    opacity: 0.8,
  },
  dangerIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: color.status.dangerSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerRowTitle: {
    ...type.bodyStrong,
    color: color.status.danger,
  },
  dangerRowSubtitle: {
    ...type.small,
    color: color.text.secondary,
  },
  versionBox: {
    alignItems: "center",
    gap: space.xs,
    marginTop: space.xl,
  },
  versionTitle: {
    ...type.micro,
    color: color.text.secondary,
  },
  versionMeta: {
    ...type.small,
    color: color.text.disabled,
  },
});
