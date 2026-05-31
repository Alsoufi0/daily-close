import { useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Button, Pill } from "../ui";
import { colors, font, radius, spacing } from "../theme";
import { supabase } from "../supabase";
import { saveToken } from "../api";
import { t } from "../i18n";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen";

const WEB_BASE = (process.env.EXPO_PUBLIC_APP_URL || "https://dailyclose.us").replace(/\/+$/, "");

// FEATURES hold translation KEYS, not English strings. We resolve via t() at
// render time so changing language re-renders without touching this array.
const FEATURES: Array<{ icon: string; titleKey: string; bodyKey: string }> = [
  { icon: "⏱", titleKey: "mobile.feature1Title", bodyKey: "mobile.feature1Body" },
  { icon: "📊", titleKey: "mobile.feature2Title", bodyKey: "mobile.feature2Body" },
  { icon: "🛡", titleKey: "mobile.feature3Title", bodyKey: "mobile.feature3Body" }
];

export function LoginScreen({ onOpen }: { onOpen: () => void }) {
  const [mode, setMode] = useState<"intro" | "signin" | "forgot">(supabase ? "intro" : "intro");
  const [authMode, setAuthMode] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
    let session;
    let error;
    if (authMode === "email") {
      const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      session = result.data.session;
      error = result.error;
    } else {
      for (const namespace of ["owners", "invites"] as const) {
        const syntheticEmail = `phone_${phone.replace(/\D/g, "")}@${namespace}.dailyclose.local`;
        const result = await supabase.auth.signInWithPassword({ email: syntheticEmail, password });
        session = result.data.session;
        error = result.error;
        if (session) break;
      }
    }
    setSubmitting(false);
    if (error || !session) {
      setError(error?.message || t("auth.couldNotSignIn"));
      return;
    }
    await saveToken(session.access_token);
    // Auth gate in App.tsx will re-render via Supabase's onAuthStateChange
    // listener; onOpen is the explicit "I'm in" signal for any wrap logic.
    onOpen();
  }

  if (mode === "forgot") {
    return <ForgotPasswordScreen onBack={() => setMode("signin")} />;
  }

  if (mode === "signin") {
    return (
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Pill label={t("auth.signInPill")} tone="good" />
        <Text style={s.hero}>{t("auth.welcomeBack")}</Text>
        <Text style={s.copy}>{t("auth.useSamePassword")}</Text>

        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <View style={s.segment}>
            <TouchableOpacity
              onPress={() => setAuthMode("email")}
              style={[s.segmentBtn, authMode === "email" && s.segmentBtnActive]}
            >
              <Text style={[s.segmentText, authMode === "email" && s.segmentTextActive]}>{t("auth.email")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAuthMode("phone")}
              style={[s.segmentBtn, authMode === "phone" && s.segmentBtnActive]}
            >
              <Text style={[s.segmentText, authMode === "phone" && s.segmentTextActive]}>{t("auth.phone")}</Text>
            </TouchableOpacity>
          </View>
          {authMode === "email" ? (
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
          ) : (
            <View>
              <Text style={s.label}>{t("auth.phoneNumber")}</Text>
              <TextInput
                style={s.input}
                autoCapitalize="none"
                keyboardType="phone-pad"
                autoComplete="tel"
                value={phone}
                onChangeText={setPhone}
                placeholder="+15551234567"
                placeholderTextColor={colors.inkMuted}
              />
            </View>
          )}
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
          <TouchableOpacity onPress={() => setMode("forgot")} style={{ alignItems: "center", paddingVertical: spacing.sm }}>
            <Text style={s.linkText}>{t("auth.forgotPassword")}</Text>
          </TouchableOpacity>
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

      <View style={s.legalRow}>
        <Text style={s.legal}>{t("auth.byContinuingYouAgree")} </Text>
        <TouchableOpacity onPress={() => Linking.openURL(`${WEB_BASE}/terms`)}>
          <Text style={s.legalLink}>{t("auth.terms")}</Text>
        </TouchableOpacity>
        <Text style={s.legal}> & </Text>
        <TouchableOpacity onPress={() => Linking.openURL(`${WEB_BASE}/privacy`)}>
          <Text style={s.legalLink}>{t("auth.privacy")}</Text>
        </TouchableOpacity>
        <Text style={s.legal}>.</Text>
      </View>
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
  legal: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 12 },
  legalLink: { color: colors.leaf, fontWeight: font.black, fontSize: 12, textDecorationLine: "underline" },
  legalRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: spacing.lg },
  linkText: { color: colors.leaf, fontWeight: font.black, fontSize: 13 },
  label: { color: colors.ink, fontWeight: font.black, fontSize: 13, marginBottom: 6 },
  segment: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.smoke
  },
  segmentBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm
  },
  segmentBtnActive: { backgroundColor: colors.white },
  segmentText: { color: colors.inkMuted, fontWeight: font.black, fontSize: 14 },
  segmentTextActive: { color: colors.ink },
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
