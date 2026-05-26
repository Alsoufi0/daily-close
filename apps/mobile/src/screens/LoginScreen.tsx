import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Pill } from "../ui";
import { colors, font, radius, spacing } from "../theme";
import { supabase } from "../supabase";
import { saveToken } from "../api";

const FEATURES = [
  { icon: "⏱", title: "Close in 2 minutes", body: "Upload, count, submit — from your phone." },
  { icon: "📊", title: "Owner sees everything", body: "Sales, closed stores, missing cash in one look." },
  { icon: "🛡", title: "Built for pilots", body: "Secure auth, audit trail, CSV export." }
];

export function LoginScreen({ onOpen }: { onOpen: (s: "owner" | "employee") => void }) {
  const [mode, setMode] = useState<"intro" | "signin">(supabase ? "intro" : "intro");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (!supabase) {
      setError("Sign in is not available in demo mode.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error || !data.session) {
      setError(error?.message || "Could not sign in.");
      return;
    }
    await saveToken(data.session.access_token);
    // Treat owners and employees the same on mobile - dashboard handles role.
    onOpen("owner");
  }

  if (mode === "signin") {
    return (
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Pill label="SIGN IN" tone="good" />
        <Text style={s.hero}>Welcome back.</Text>
        <Text style={s.copy}>Use the same email and password as the web app.</Text>

        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <View>
            <Text style={s.label}>Email</Text>
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
            <Text style={s.label}>Password</Text>
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
            title={submitting ? "Signing in…" : "Sign in"}
            onPress={signIn}
            disabled={submitting}
          />
          <Button title="Back" variant="secondary" onPress={() => setMode("intro")} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <Pill label="MOBILE PILOT" tone="good" />
      <Text style={s.hero}>
        Close the store <Text style={{ color: colors.leaf }}>from your phone.</Text>
      </Text>
      <Text style={s.copy}>
        Owners see sales, closed stores, and missing cash. Employees follow one simple step at a time.
      </Text>

      <View style={s.features}>
        {FEATURES.map((f) => (
          <View key={f.title} style={s.feature}>
            <Text style={s.featureIcon}>{f.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.featureTitle}>{f.title}</Text>
              <Text style={s.featureBody}>{f.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {supabase ? (
          <Button title="Sign in" onPress={() => setMode("signin")} />
        ) : (
          <View style={s.errorBox}>
            <Text style={s.errorText}>
              This build is missing its API and Supabase configuration. Reinstall
              the official release or contact your administrator.
            </Text>
          </View>
        )}
      </View>

      <Text style={s.legal}>By continuing you agree to the Terms and Privacy Policy.</Text>
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
