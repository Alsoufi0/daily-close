import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
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
  const dateValue = value && ISO.test(value) ? new Date(`${value}T12:00:00`) : new Date();

  function onPick(_e: DateTimePickerEvent, picked?: Date) {
    if (Platform.OS !== "ios") setOpen(false);
    if (picked) onChange(toIso(picked));
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
      <Pressable onPress={() => setOpen(true)} style={s.field}>
        <Text style={[s.value, !value && s.placeholder]}>
          {value || placeholder || "YYYY-MM-DD"}
        </Text>
        <Text style={s.icon}>📅</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={onPick}
          maximumDate={maximumDate}
        />
      ) : null}
      {open && Platform.OS === "ios" ? (
        <Pressable onPress={() => setOpen(false)} style={s.doneBtn}>
          <Text style={s.doneText}>{t("common.done")}</Text>
        </Pressable>
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
  doneBtn: { alignSelf: "flex-end", paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  doneText: { color: colors.leaf, fontWeight: font.black, fontSize: 15 }
});
