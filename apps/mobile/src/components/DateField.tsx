import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { t } from "../i18n";
import { colors, font, radius, spacing } from "../theme";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function toIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * A tap-to-open calendar field that reads/writes a `yyyy-MM-dd` string (the
 * format the API + web expect). Replaces the old "type the date" inputs so
 * users can't enter malformed/blank dates. `onClear` is optional — when given,
 * a small "Clear" affordance lets the user reset the field.
 *
 * Android uses the native date dialog. iOS presents the calendar in its own
 * bottom-sheet modal with Cancel/Done — the old `display="inline"` injected the
 * picker straight into the page, which rendered as a cramped, hard-to-dismiss
 * two-month strip. The draft date is only committed when the user taps Done.
 */
export function DateField({
  label,
  value,
  onChange,
  onClear,
  placeholder,
  maximumDate
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  onClear?: () => void;
  placeholder?: string;
  maximumDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  // iOS keeps the in-progress selection here until the user confirms with Done.
  const [draft, setDraft] = useState<Date | null>(null);
  const dateValue = value && ISO.test(value) ? new Date(`${value}T12:00:00`) : new Date();

  function openPicker() {
    setDraft(dateValue);
    setOpen(true);
  }

  // Android: the native dialog returns once, on selection or dismissal.
  function onAndroidChange(e: DateTimePickerEvent, picked?: Date) {
    setOpen(false);
    if (e.type === "set" && picked) onChange(toIso(picked));
  }

  return (
    <View>
      {label ? (
        <View style={s.labelRow}>
          <Text style={s.label}>{label}</Text>
          {onClear && value ? (
            <Pressable onPress={onClear} hitSlop={8}>
              <Text style={s.clear}>{t("common.clear")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Pressable onPress={openPicker} style={s.field}>
        <Text style={[s.value, !value && s.placeholder]}>
          {value || placeholder || "YYYY-MM-DD"}
        </Text>
        <Text style={s.icon}>📅</Text>
      </Pressable>

      {/* Android: native modal dialog. */}
      {open && Platform.OS !== "ios" ? (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="default"
          onChange={onAndroidChange}
          maximumDate={maximumDate}
        />
      ) : null}

      {/* iOS: our own bottom-sheet modal so the calendar isn't crammed inline. */}
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
                  if (draft) onChange(toIso(draft));
                  setOpen(false);
                }}
                hitSlop={10}
              >
                <Text style={s.doneText}>{t("common.done")}</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={draft || dateValue}
              mode="date"
              display="inline"
              themeVariant="light"
              onChange={(_e, picked) => {
                if (picked) setDraft(picked);
              }}
              maximumDate={maximumDate}
              style={s.iosPicker}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  label: { color: colors.ink, fontWeight: font.black, fontSize: 12 },
  clear: { color: colors.leaf, fontWeight: font.black, fontSize: 12 },
  field: {
    flexDirection: "row", alignItems: "center",
    minHeight: 44, paddingHorizontal: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.inputBorder,
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
