import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Pill } from "../ui";
import { colors, font, radius, spacing } from "../theme";
import { supabase } from "../supabase";
import { saveToken } from "../api";
import { t } from "../i18n";

// FEATURES hold translation KEYS, not English strings. We resolve via t() at
// render time so changing language re-renders without touching this array.
const FEATURES: Array<{ icon: string; titleKey: string; bodyKey: string }> = [
  { icon: "⏱", titleKey: "mobile.feature1Title", bodyKey: "mobile.feature1Body" },
  { icon: "📊", titleKey: "mobile.feature2Title", bodyKey: "mobile.feature2Body" },
  { icon: "🛡", titleKey: "mobile.feature3Title", bodyKey: "mobile.feature3Body" }
];

export function LoginScreen({ onOpen }: { onOpen: (s: "owner" | "employee") => void }) {
  const [mode, setMode] = useState<"intro" | "signin">(supabase ? "intro" : "intro");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (!supabase) {
      setError(t("auth.demoFallback"));
      return;
    }
    setSubmitting(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error || !data.session) {
      setError(error?.message || t("auth.couldNotSignIn"));
      return;
    }
    await saveToken(data.session.access_token);
    // Treat owners and employees the same on mobile - dashboard handles role.
    onOpen("owner");
  }

  if (mode === "signin") {
    return (
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Pill label={t("auth.signInPill")} tone="good" />
        <Text style={s.hero}>{t("auth.welcomeBack")}</Text>
        <Text style={s.copy}>{t("auth.useSamePassword")}</Text>

        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <View>
            <Text style={s.label}>{t("auth.email")}</Text>
            <TextInput
              style={s.input}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@store.com"
              placeholderTextColor={colors.inkMuted}
            />
          </View>
          <View>
            <Text style={s.label}>{t("auth.password")}</Text>
            <TextInput
              style={s.input}
              secureTextEntry
              autoComplete="current-password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.inkMuted}
            />
          </View>

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            title={submitting ? t("auth.signingIn") : t("auth.signIn")}
            onPress={signIn}
            disabled={submitting}
          />
          <Button title={t("common.back")} variant="secondary" onPress={() => setMode("intro")} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <Pill label={t("mobile.pilotPill")} tone="good" />
      <Text style={s.hero}>
        {t("mobile.hero")} <Text style={{ color: colors.leaf }}>{t("mobile.heroAccent")}</Text>
      </Text>
      <Text style={s.copy}>{t("mobile.copy")}</Text>

      <View style={s.features}>
        {FEATURES.map((f) => (
          <View key={f.titleKey} style={s.feature}>
            <Text style={s.featureIcon}>{f.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.featureTitle}>{t(f.titleKey)}</Text>
              <Text style={s.featureBody}>{t(f.bodyKey)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {supabase ? (
          <Button title={t("auth.signIn")} onPress={() => setMode("signin")} />
        ) : (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{t("auth.buildMisconfigured")}</Text>
          </View>
        )}
      </View>

      <Text style={s.legal}>{t("auth.termsAcceptance")}</Text>
      {submitting ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.md, paddingBottom: 48 },
  hero: { color: colors.ink, fontWeight: font.black, fontSize: 34, lineHeight: 40, marginTop: spacing.md },
  copy: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 16, lineHeight: 24, marginTop: spacing.xs },
  features: { gap: spacing.sm, marginTop: spacing.lg },
  feature: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border
  },
  featureIcon: { fontSize: 22 },
  featureTitle: { color: colors.ink, fontWeight: font.black, fontSize: 15 },
  featureBody: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 13, marginTop: 2 },
  legal: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 12, textAlign: "center", marginTop: spacing.lg },
  label: { color: colors.ink, fontWeight: font.black, fontSize: 13, marginBottom: 6 },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
    fontWeight: font.bold
  },
  errorBox: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md
  },
  errorText: { color: colors.warning, fontWeight: font.bold, fontSize: 13 }
});
