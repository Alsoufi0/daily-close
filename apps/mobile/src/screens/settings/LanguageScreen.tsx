import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Banner, Card } from "../../ui";
import { getMobileLanguage, setMobileLanguage } from "../../i18n";
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

  async function pick(code: Language) {
    setMobileLanguage(code);
    setCurrent(code);
    await AsyncStorage.setItem(STORAGE_KEY, code);
    if (code === "ar") {
      // RTL switch requires app reload to fully take effect — React Native
      // I18nManager is read at module init for the layout direction.
      Alert.alert(
        "Restart app",
        "Arabic uses right-to-left layout. Close and reopen the app to apply the new direction.",
        [{ text: "OK" }]
      );
    }
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Card style={{ gap: spacing.md }}>
        <View style={s.iconRow}>
          <View style={s.iconBg}><Text style={s.iconText}>🌐</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>App language</Text>
            <Text style={s.subtitle}>Choose your preferred language. Affects in-app text only.</Text>
          </View>
        </View>

        <Banner
          tone="warn"
          title="Translation coverage is partial"
          body="~60 strings on mobile are still English-only. We're working through them — see the pre-publishing backlog."
        />

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
