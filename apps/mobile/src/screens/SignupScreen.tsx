import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { Button, Pill } from "../ui";
import { LanguageSelector } from "../components/LanguageSelector";
import { colors, font, radius, spacing } from "../theme";
import { supabase } from "../supabase";
import {
  bootstrapOwner,
  confirmPhoneLogin,
  requestPhoneLogin,
  saveToken,
  signupOwner
} from "../api";
import { t } from "../i18n";

// Native owner sign-up — mirrors the web /signup flow: create the account, sign
// in, then bootstrap the owner. After onOpen() the auth gate flips to "in" and
// the Owner dashboard shows the first-store setup wizard for a brand-new owner.
export function SignupScreen({ onOpen, onBack }: { onOpen: () => void; onBack: () => void }) {
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finishWithSession(token: string) {
    await bootstrapOwner(name.trim());
    await saveToken(token);
    onOpen();
  }

  async function submit() {
    if (!supabase) {
      setError(t("auth.buildMisconfigured"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.atLeast8CharsShort"));
      return;
    }
    const e = email.trim();
    const p = phone.trim();
    if (mode === "email" && !e) {
      setError(t("auth.email"));
      return;
    }
    if (mode === "phone" && !p) {
      setError(t("auth.phoneNumber"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signupOwner({
        name: name.trim(),
        email: mode === "email" ? e : undefined,
        phone: mode === "phone" ? p : undefined,
        password
      });
      if (mode === "phone") {
        await requestPhoneLogin(p);
        setNeedsConfirm(true);
        return;
      }
      const r = await supabase.auth.signInWithPassword({ email: e, password });
      if (r.error || !r.data.session) {
        // Email confirmation required before a session exists.
        setNeedsConfirm(true);
        return;
      }
      await finishWithSession(r.data.session.access_token);
    } catch (err: any) {
      setError(err?.message || t("auth.couldNotSignIn"));
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyPhone() {
    if (!supabase) {
      setError(t("auth.buildMisconfigured"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await confirmPhoneLogin({ phone: phone.trim(), code: phoneCode.trim() });
      const verified = await supabase.auth.verifyOtp({ token_hash: result.tokenHash, type: result.type });
      if (verified.error || !verified.data.session) {
        setError(verified.error?.message || t("auth.phoneCodeFailed"));
        return;
      }
      await finishWithSession(verified.data.session.access_token);
    } catch (err: any) {
      setError(err?.message || t("auth.phoneCodeFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (needsConfirm) {
    return (
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <LanguageSelector />
        <Text style={s.hero}>{mode === "phone" ? t("auth.confirmNumber") : t("auth.checkEmail")}</Text>
        <Text style={s.copy}>{mode === "phone" ? t("auth.phoneConfirmSent") : t("auth.emailConfirmSent")}</Text>
        {mode === "phone" ? (
          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            <View>
              <Text style={s.label}>{t("auth.sixDigitCode")}</Text>
              <TextInput
                style={s.input}
                keyboardType="number-pad"
                value={phoneCode}
                onChangeText={(v) => setPhoneCode(v.replace(/[^0-9]/g, ""))}
                maxLength={6}
                placeholder="123456"
                placeholderTextColor={colors.inkMuted}
              />
            </View>
            {error ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}
            <Button
              title={submitting ? t("auth.verifying") : t("auth.verifyContinue")}
              onPress={verifyPhone}
              disabled={submitting || phoneCode.length < 6}
            />
          </View>
        ) : (
          <Button title={t("common.back")} variant="secondary" onPress={onBack} />
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <LanguageSelector />
      <Pill label={t("auth.startTrial")} tone="good" />
      <Text style={s.hero}>{t("auth.createMyAccount")}</Text>
      <Text style={s.copy}>{t("auth.trialNoCard")}</Text>

      <View style={s.benefits}>
        <Text style={s.benefit}>✓ {t("billing.multiStoreDashboard")}</Text>
        <Text style={s.benefit}>✓ {t("auth.dailyCloseAnyPhone")}</Text>
        <Text style={s.benefit}>✓ {t("auth.csvMissedAlerts")}</Text>
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        <View>
          <Text style={s.label}>{t("auth.yourName")}</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholderTextColor={colors.inkMuted} />
        </View>

        <View style={s.segment}>
          <TouchableOpacity onPress={() => setMode("email")} style={[s.segmentBtn, mode === "email" && s.segmentBtnActive]}>
            <Text style={[s.segmentText, mode === "email" && s.segmentTextActive]}>{t("auth.email")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode("phone")} style={[s.segmentBtn, mode === "phone" && s.segmentBtnActive]}>
            <Text style={[s.segmentText, mode === "phone" && s.segmentTextActive]}>{t("auth.phone")}</Text>
          </TouchableOpacity>
        </View>

        {mode === "email" ? (
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
              keyboardType="phone-pad"
              autoComplete="tel"
              value={phone}
              onChangeText={setPhone}
              placeholder="+15551234567"
              placeholderTextColor={colors.inkMuted}
            />
            <Text style={s.help}>{t("auth.phoneCountryHelp")}</Text>
          </View>
        )}

        <View>
          <Text style={s.label}>{t("auth.password")}</Text>
          <TextInput
            style={s.input}
            secureTextEntry
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.inkMuted}
          />
          <Text style={s.help}>{t("auth.atLeast8CharsShort")}</Text>
        </View>

        {error ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <Button title={submitting ? t("auth.creatingAccount") : t("auth.createMyAccount")} onPress={submit} disabled={submitting} />
        <TouchableOpacity onPress={onBack} style={{ alignItems: "center", paddingVertical: spacing.sm }}>
          <Text style={s.linkText}>{t("auth.alreadyHaveAccount")} {t("auth.signIn")}</Text>
        </TouchableOpacity>
      </View>
      {submitting ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.md, paddingBottom: 48 },
  hero: { color: colors.ink, fontWeight: font.black, fontSize: 30, lineHeight: 36, marginTop: spacing.md },
  copy: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 15, lineHeight: 22, marginTop: spacing.xs },
  benefits: { gap: 4, marginTop: spacing.md },
  benefit: { color: colors.ink, fontWeight: font.bold, fontSize: 14 },
  label: { color: colors.ink, fontWeight: font.black, fontSize: 13, marginBottom: 6 },
  help: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 12, marginTop: 6 },
  input: {
    height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.inputBorder,
    paddingHorizontal: 14, fontSize: 16, color: colors.ink, backgroundColor: colors.white, fontWeight: font.bold
  },
  segment: { flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: colors.smoke },
  segmentBtn: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  segmentBtnActive: { backgroundColor: colors.white },
  segmentText: { color: colors.inkMuted, fontWeight: font.black, fontSize: 14 },
  segmentTextActive: { color: colors.ink },
  linkText: { color: colors.leaf, fontWeight: font.black, fontSize: 13 },
  errorBox: { backgroundColor: colors.warningSoft, borderColor: colors.warningBorder, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.warning, fontWeight: font.bold, fontSize: 13 }
});
