import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { Banner, Button } from "../ui";
import { confirmPhonePasswordReset, requestPhonePasswordReset } from "../api";
import { supabase } from "../supabase";
import { t } from "../i18n";
import { colors, font, radius, spacing } from "../theme";

const WEB_BASE = (process.env.EXPO_PUBLIC_APP_URL || "https://dailyclose.us").replace(/\/+$/, "");

/**
 * Forgot-password flow. Mirrors web's `/forgot-password` route:
 * - User enters email
 * - We call supabase.auth.resetPasswordForEmail with a redirect that
 *   sends them to the web `/account/password` page so they can pick
 *   a new password in a browser (Supabase password-reset link can't
 *   open the mobile app without a deep-link config, which we don't
 *   have yet).
 *
 * Once they reset on web, they can sign back in on mobile.
 */
export function ForgotPasswordScreen({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "code">("idle");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!email.trim()) {
      setError(t("auth.emailRequired"));
      return;
    }
    if (!supabase) {
      setError(t("auth.buildMisconfigured"));
      return;
    }
    setStatus("loading");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${WEB_BASE}/account/password`
    });
    if (err) {
      setError(err.message);
      setStatus("idle");
      return;
    }
    setStatus("sent");
  }

  async function sendPhoneCode() {
    setError(null);
    if (!phone.trim()) {
      setError(t("auth.phoneNumber"));
      return;
    }
    setPhoneBusy(true);
    try {
      await requestPhonePasswordReset(phone.trim());
      setStatus("code");
    } catch (err: any) {
      setError(err?.message || t("auth.phoneCodeFailed"));
      setStatus("idle");
    } finally {
      setPhoneBusy(false);
    }
  }

  async function confirmPhoneCode() {
    setError(null);
    setPhoneBusy(true);
    try {
      await confirmPhonePasswordReset({
        phone: phone.trim(),
        code: code.trim(),
        password: newPassword
      });
      setStatus("sent");
    } catch (err: any) {
      setError(err?.message || t("auth.codeInvalid"));
      setStatus("code");
    } finally {
      setPhoneBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack} style={s.backRow}>
          <Text style={s.backText}>‹ {t("auth.backToSignIn")}</Text>
        </TouchableOpacity>

        <View style={s.card}>
          <Text style={s.title}>{t("auth.forgotPassword")}</Text>
          <Text style={s.body}>{t("auth.forgotPasswordBody")}</Text>

          <View style={s.segment}>
            <TouchableOpacity onPress={() => { setMode("email"); setStatus("idle"); }} style={[s.segmentBtn, mode === "email" && s.segmentBtnActive]}>
              <Text style={[s.segmentText, mode === "email" && s.segmentTextActive]}>{t("auth.email")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setMode("phone"); setStatus("idle"); }} style={[s.segmentBtn, mode === "phone" && s.segmentBtnActive]}>
              <Text style={[s.segmentText, mode === "phone" && s.segmentTextActive]}>{t("auth.phone")}</Text>
            </TouchableOpacity>
          </View>

          {status === "sent" ? (
            <Banner tone="good" title={mode === "email" ? t("auth.resetLinkSent") : t("auth.passwordUpdated")} body={mode === "email" ? t("auth.checkEmailToReset") : t("auth.useSamePassword")} />
          ) : null}

          {error ? <Banner tone="bad" title={t("common.error")} body={error} /> : null}

          {status !== "sent" && mode === "email" ? (
            <>
              <View style={{ marginTop: spacing.md }}>
                <Text style={s.label}>{t("auth.email")}</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@store.com"
                  placeholderTextColor={colors.inkMuted}
                  style={s.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoFocus
                />
              </View>
              <View style={{ marginTop: spacing.md }}>
                <Button
                  title={status === "loading" ? t("common.sending") : t("auth.sendResetLink")}
                  onPress={submit}
                  loading={status === "loading"}
                  disabled={status === "loading"}
                />
              </View>
              {status === "loading" ? <ActivityIndicator style={{ marginTop: spacing.sm }} color={colors.leaf} /> : null}
            </>
          ) : status !== "sent" && status !== "code" ? (
            <>
              <View style={{ marginTop: spacing.md }}>
                <Text style={s.label}>{t("auth.phoneNumber")}</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+15551234567"
                  placeholderTextColor={colors.inkMuted}
                  style={s.input}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoComplete="tel"
                />
              </View>
              <View style={{ marginTop: spacing.md }}>
                <Button
                  title={phoneBusy ? t("common.sending") : t("auth.sendCode")}
                  onPress={sendPhoneCode}
                  loading={phoneBusy}
                  disabled={phoneBusy}
                />
              </View>
            </>
          ) : status === "code" ? (
            <>
              <View style={{ marginTop: spacing.md }}>
                <Text style={s.label}>{t("auth.sixDigitCode")}</Text>
                <TextInput value={code} onChangeText={(v) => setCode(v.replace(/[^0-9]/g, ""))} style={s.input} keyboardType="number-pad" maxLength={6} />
              </View>
              <View style={{ marginTop: spacing.md }}>
                <Text style={s.label}>{t("auth.password")}</Text>
                <TextInput value={newPassword} onChangeText={setNewPassword} style={s.input} secureTextEntry autoComplete="new-password" />
              </View>
              <Button title={phoneBusy ? t("common.saving") : t("auth.verifyContinue")} onPress={confirmPhoneCode} loading={phoneBusy} disabled={phoneBusy || code.length < 6 || newPassword.length < 8} />
            </>
          ) : (
            <Button title={t("auth.backToSignIn")} onPress={onBack} variant="secondary" />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40 },
  backRow: { paddingVertical: spacing.sm, marginBottom: spacing.md },
  backText: { color: colors.inkSoft, fontWeight: font.black, fontSize: 14 },
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, gap: spacing.md
  },
  title: { color: colors.ink, fontWeight: font.black, fontSize: 22, letterSpacing: -0.3 },
  body: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 14, lineHeight: 20 },
  label: { color: colors.ink, fontWeight: font.black, fontSize: 13, marginBottom: 6 },
  segment: { flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: colors.smoke },
  segmentBtn: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  segmentBtnActive: { backgroundColor: colors.white },
  segmentText: { color: colors.inkMuted, fontWeight: font.black, fontSize: 14 },
  segmentTextActive: { color: colors.ink },
  input: {
    minHeight: 50, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.inputBorder,
    fontSize: 15, color: colors.ink, backgroundColor: colors.white, fontWeight: font.bold
  }
});
