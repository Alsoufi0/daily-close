import { Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Language } from "@smokeshop/shared/i18n";
import { getMobileLanguage, setMobileLanguage } from "../i18n";
import { colors, font, radius } from "../theme";

// 2-letter codes (not flag emojis) — Android doesn't render country-flag emojis.
const LANGS: Array<{ code: Language; label: string }> = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "ar", label: "AR" },
  { code: "hi", label: "HI" }
];

/**
 * Compact language switcher for the welcome + sign-in screens. Tapping a code
 * applies the language live (App re-renders via onLanguageChange) and persists
 * it so the next launch starts in the chosen language.
 */
export function LanguageSelector() {
  const current = getMobileLanguage();

  function pick(code: Language) {
    if (code === current) return;
    setMobileLanguage(code);
    AsyncStorage.setItem("dailyclose:language", code).catch(() => {});
  }

  return (
    <View style={s.row}>
      {LANGS.map((l) => {
        const active = l.code === current;
        return (
          <Pressable
            key={l.code}
            onPress={() => pick(l.code)}
            style={[s.btn, active && s.btnActive]}
            accessibilityLabel={l.label}
          >
            <Text style={[s.label, active && s.labelActive]}>{l.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, alignSelf: "flex-end" },
  btn: {
    minWidth: 42, paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white, alignItems: "center"
  },
  btnActive: { backgroundColor: colors.leaf, borderColor: colors.leaf },
  label: { color: colors.inkSoft, fontWeight: font.black, fontSize: 13 },
  labelActive: { color: colors.white }
});
