import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Card } from "../../ui";
import { changeLanguage, getMobileLanguage, setMobileLanguage, t } from "../../i18n";
import type { Language } from "@smokeshop/shared/i18n";
import { colors, font, radius, spacing } from "../../theme";

const LANGUAGES: Array<{ code: Language; label: string; native: string; flag: string }> = [
  { code: "en", label: "English", native: "English", flag: "🇺🇸" },
  { code: "es", label: "Spanish", native: "Español", flag: "🇪🇸" },
  { code: "ar", label: "Arabic", native: "العربية", flag: "🇸🇦" },
  { code: "hi", label: "Hindi", native: "हिन्दी", flag: "🇮🇳" }
];

const STORAGE_KEY = "dailyclose:language";

export function LanguageScreen() {
  const [current, setCurrent] = useState<Language>(getMobileLanguage());

  // Persist + apply
  useEffect(() => {
    // Read persisted choice in case the app booted with a different in-memory default.
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === "en" || v === "es" || v === "ar" || v === "hi") {
        setMobileLanguage(v);
        setCurrent(v);
      }
    });
  }, []);

  function pick(code: Language) {
    setCurrent(code);
    // Persists, applies live, and reloads the app when crossing the Arabic (RTL)
    // boundary so the mirrored layout direction takes effect without the user
    // having to fully close and reopen the app.
    changeLanguage(code).catch(() => {});
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Card style={{ gap: spacing.md }}>
        <View style={s.iconRow}>
          <View style={s.iconBg}><Text style={s.iconText}>🌐</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{t("language.title")}</Text>
            <Text style={s.subtitle}>{t("language.subtitle")}</Text>
          </View>
        </View>

        <View style={{ gap: spacing.xs }}>
          {LANGUAGES.map((lang) => {
            const active = current === lang.code;
            return (
              <Pressable
                key={lang.code}
                onPress={() => pick(lang.code)}
                style={[s.row, active && s.rowActive]}
              >
                <Text style={s.flag}>{lang.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.langNative, active && { color: colors.leaf }]}>{lang.native}</Text>
                  <Text style={s.langLabel}>{lang.label}</Text>
                </View>
                {active ? <Text style={s.check}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40 },
  iconRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBg: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.leafSoft, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 20 },
  title: { color: colors.ink, fontWeight: font.black, fontSize: 18 },
  subtitle: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12, marginTop: 2 },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md
  },
  rowActive: { borderColor: colors.leaf, backgroundColor: colors.leafSoft },
  flag: { fontSize: 24 },
  langNative: { color: colors.ink, fontWeight: font.black, fontSize: 16 },
  langLabel: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12, marginTop: 2 },
  check: { color: colors.leaf, fontWeight: font.black, fontSize: 20 }
});
