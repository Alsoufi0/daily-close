import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { t } from "../i18n";
import { colors, font, radius, spacing } from "../theme";

const HHMM = /^\d{1,2}:\d{2}$/;

function toHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function parseHHMM(value: string): Date {
  const base = new Date();
  if (value && HHMM.test(value)) {
    const [hh, mm] = value.split(":").map((n) => Number(n) || 0);
    base.setHours(hh, mm, 0, 0);
  } else {
    base.setHours(23, 30, 0, 0);
  }
  return base;
}

/**
 * Tap-to-open time field that reads/writes a 24h "HH:MM" string (the format the
 * API stores for a store's close time). Replaces the free-text time input so a
 * malformed/blank time can't be entered. iOS shows a slide wheel in a
 * bottom-sheet (committed on Done); Android uses the native clock dialog.
 */
export function TimeField({
  label,
  value,
  onChange,
  placeholder
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);
  const timeValue = parseHHMM(value);

  function openPicker() {
    setDraft(timeValue);
    setOpen(true);
  }

  function onAndroidChange(e: DateTimePickerEvent, picked?: Date) {
    setOpen(false);
    if (e.type === "set" && picked) onChange(toHHMM(picked));
  }

  return (
    <View>
      {label ? <Text style={s.label}>{label}</Text> : null}

      <Pressable onPress={openPicker} style={s.field}>
        <Text style={[s.value, !value && s.placeholder]}>{value || placeholder || "23:30"}</Text>
        <Text style={s.icon}>🕐</Text>
      </Pressable>

      {open && Platform.OS !== "ios" ? (
        <DateTimePicker value={timeValue} mode="time" is24Hour display="default" onChange={onAndroidChange} />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Text style={s.cancelText}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (draft) onChange(toHHMM(draft));
                  setOpen(false);
                }}
                hitSlop={10}
              >
                <Text style={s.doneText}>{t("common.done")}</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={draft || timeValue}
              mode="time"
              display="spinner"
              themeVariant="light"
              onChange={(_e, picked) => {
                if (picked) setDraft(picked);
              }}
              style={s.iosPicker}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  label: { color: colors.ink, fontWeight: font.black, fontSize: 12, marginBottom: 4 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.white
  },
  value: { flex: 1, color: colors.ink, fontWeight: font.bold, fontSize: 14 },
  placeholder: { color: colors.inkMuted },
  icon: { fontSize: 16 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  cancelText: { color: colors.inkSoft, fontWeight: font.black, fontSize: 16 },
  doneText: { color: colors.leaf, fontWeight: font.black, fontSize: 16 },
  iosPicker: { alignSelf: "center" }
});
