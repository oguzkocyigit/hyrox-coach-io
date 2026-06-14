/**
 * Idmanin tarihini ve opsiyonel baslangic/bitis saatini secen hafif (saf JS)
 * bilesen. Native datetimepicker bagimliligi gerektirmez.
 *
 * - Tarih: "Bugun" / "Dun" hizli chip'leri + son N gunu listeleyen modal.
 * - Saat: iki kolonlu (saat / dakika) basit secici modal.
 *
 * Hem manuel kayit ekraninda (gecmise donuk kayit) hem canli oturum bitir
 * panelinde (sabah baslatmayi unutunca saatleri elle girme) kullanilir.
 */

import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/ui/Button";
import { color, font, radius, space, type } from "@/ui/tokens";
import {
  dayLabel,
  fullDayLabel,
  isSameDay,
  minutesToLabel,
  startOfDay,
  type WhenState,
} from "@/features/workout-log/when";

type WhenFieldProps = {
  value: WhenState;
  onChange: (next: WhenState) => void;
  /** Baslangic/bitis saati alanlarini goster (varsayilan true). */
  showTimes?: boolean;
  /** Tarih listesinin kac gun geriye gidecegi (varsayilan 60). */
  pastDays?: number;
};

const MINUTE_STEP = 5;

export function WhenField({
  value,
  onChange,
  showTimes = true,
  pastDays = 60,
}: WhenFieldProps) {
  const [dateModal, setDateModal] = useState(false);
  const [timeTarget, setTimeTarget] = useState<"start" | "end" | null>(null);

  const recentDays = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < pastDays; i++) {
      const d = startOfDay(new Date());
      d.setDate(d.getDate() - i);
      out.push(d);
    }
    return out;
  }, [pastDays]);

  const setDate = (d: Date) => onChange({ ...value, date: startOfDay(d) });
  const setTime = (target: "start" | "end", minutes: number | null) =>
    onChange({
      ...value,
      [target === "start" ? "startMin" : "endMin"]: minutes,
    });

  return (
    <View style={styles.root}>
      <Text style={styles.fieldLabel}>TARIH</Text>

      <Pressable onPress={() => setDateModal(true)} style={styles.dateButton}>
        <Ionicons name="calendar-outline" size={18} color={color.accent.primary} />
        <Text style={styles.dateButtonText}>{fullDayLabel(value.date)}</Text>
        <Ionicons name="chevron-down" size={16} color={color.text.secondary} />
      </Pressable>

      {showTimes ? (
        <View style={styles.timeRow}>
          <TimeButton
            caption="Baslangic"
            minutes={value.startMin}
            onPress={() => setTimeTarget("start")}
            onClear={() => setTime("start", null)}
          />
          <TimeButton
            caption="Bitis"
            minutes={value.endMin}
            onPress={() => setTimeTarget("end")}
            onClear={() => setTime("end", null)}
          />
        </View>
      ) : null}

      {showTimes && value.startMin != null && value.endMin != null ? (
        <Text style={styles.derivedHint}>
          {value.endMin > value.startMin
            ? `Sure otomatik: ${value.endMin - value.startMin} dk`
            : "Bitis baslangictan sonra olmali — sureyi elle gir."}
        </Text>
      ) : null}

      <DateListModal
        visible={dateModal}
        days={recentDays}
        selected={value.date}
        onSelect={(d) => {
          setDate(d);
          setDateModal(false);
        }}
        onClose={() => setDateModal(false)}
      />

      <TimePickerModal
        visible={timeTarget != null}
        initialMinutes={
          timeTarget === "start"
            ? value.startMin
            : timeTarget === "end"
              ? value.endMin
              : null
        }
        onConfirm={(minutes) => {
          if (timeTarget) setTime(timeTarget, minutes);
          setTimeTarget(null);
        }}
        onClose={() => setTimeTarget(null)}
      />
    </View>
  );
}

function TimeButton({
  caption,
  minutes,
  onPress,
  onClear,
}: {
  caption: string;
  minutes: number | null;
  onPress: () => void;
  onClear: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.timeButton}>
      <Text style={styles.timeCaption}>{caption.toUpperCase()}</Text>
      <View style={styles.timeValueRow}>
        <Text style={[styles.timeValue, minutes == null && styles.timeValueEmpty]}>
          {minutes == null ? "Sec" : minutesToLabel(minutes)}
        </Text>
        {minutes != null ? (
          <Pressable onPress={onClear} hitSlop={8} accessibilityLabel={`${caption} saatini temizle`}>
            <Ionicons name="close-circle" size={16} color={color.text.disabled} />
          </Pressable>
        ) : (
          <Ionicons name="time-outline" size={16} color={color.text.secondary} />
        )}
      </View>
    </Pressable>
  );
}

function DateListModal({
  visible,
  days,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  days: Date[];
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.sheetTitle}>Tarih Sec</Text>
          <ScrollView style={styles.dateList} showsVerticalScrollIndicator={false}>
            {days.map((d) => {
              const active = isSameDay(d, selected);
              return (
                <Pressable
                  key={d.toISOString()}
                  onPress={() => onSelect(d)}
                  style={[styles.dateRow, active && styles.dateRowActive]}
                >
                  <Text style={[styles.dateRowText, active && styles.dateRowTextActive]}>
                    {dayLabel(d)}
                  </Text>
                  {active ? (
                    <Ionicons name="checkmark" size={18} color={color.accent.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TimePickerModal({
  visible,
  initialMinutes,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  initialMinutes: number | null;
  onConfirm: (minutes: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const base = initialMinutes ?? new Date().getHours() * 60 + new Date().getMinutes();
  const [hour, setHour] = useState(Math.floor(base / 60));
  const [minute, setMinute] = useState(Math.round((base % 60) / MINUTE_STEP) * MINUTE_STEP);

  // visible degisince secimi sifirla (controlled olmayan local state)
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(
    () => Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP),
    [],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => {
        const b =
          initialMinutes ?? new Date().getHours() * 60 + new Date().getMinutes();
        setHour(Math.floor(b / 60));
        setMinute(Math.round((b % 60) / MINUTE_STEP) * MINUTE_STEP);
      }}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.sheetTitle}>Saat Sec</Text>
          <View style={styles.wheelRow}>
            <ScrollView style={styles.wheel} showsVerticalScrollIndicator={false}>
              {hours.map((h) => (
                <Pressable
                  key={h}
                  onPress={() => setHour(h)}
                  style={[styles.wheelItem, hour === h && styles.wheelItemActive]}
                >
                  <Text style={[styles.wheelText, hour === h && styles.wheelTextActive]}>
                    {String(h).padStart(2, "0")}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.wheelColon}>:</Text>
            <ScrollView style={styles.wheel} showsVerticalScrollIndicator={false}>
              {minutes.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMinute(m)}
                  style={[styles.wheelItem, minute === m && styles.wheelItemActive]}
                >
                  <Text style={[styles.wheelText, minute === m && styles.wheelTextActive]}>
                    {String(m).padStart(2, "0")}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <Button label="Tamam" onPress={() => onConfirm(hour * 60 + minute)} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: space.sm,
  },
  fieldLabel: {
    ...type.micro,
    color: color.text.secondary,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    backgroundColor: color.bg.surface,
  },
  dateButtonText: {
    ...type.body,
    color: color.text.primary,
    flex: 1,
  },
  timeRow: {
    flexDirection: "row",
    gap: space.sm,
  },
  timeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.stroke.strong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: color.bg.surface,
    gap: 2,
  },
  timeCaption: {
    ...type.micro,
    color: color.text.disabled,
  },
  timeValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeValue: {
    fontFamily: font.data.medium,
    fontSize: 16,
    color: color.text.primary,
  },
  timeValueEmpty: {
    color: color.text.secondary,
  },
  derivedHint: {
    ...type.small,
    color: color.accent.primary,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: color.bg.base,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.xl,
    gap: space.lg,
  },
  sheetTitle: {
    ...type.heading1,
    color: color.text.primary,
  },
  dateList: {
    maxHeight: 320,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  dateRowActive: {
    backgroundColor: color.accent.subtle,
  },
  dateRowText: {
    ...type.body,
    color: color.text.primary,
  },
  dateRowTextActive: {
    color: color.accent.primary,
    fontFamily: "Manrope_600SemiBold",
  },
  wheelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
  },
  wheel: {
    maxHeight: 220,
    width: 80,
    backgroundColor: color.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.stroke.subtle,
  },
  wheelItem: {
    paddingVertical: space.sm,
    alignItems: "center",
  },
  wheelItemActive: {
    backgroundColor: color.accent.subtle,
  },
  wheelText: {
    fontFamily: font.data.regular,
    fontSize: 18,
    color: color.text.secondary,
  },
  wheelTextActive: {
    color: color.accent.primary,
    fontFamily: font.data.medium,
  },
  wheelColon: {
    fontFamily: font.data.medium,
    fontSize: 22,
    color: color.text.primary,
  },
});
