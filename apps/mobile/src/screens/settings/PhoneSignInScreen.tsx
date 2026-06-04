import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Banner, Button, Card } from "../../ui";
import {
  ApiError,
  addPhoneLoginConfirm,
  addPhoneLoginRequest,
  getPhoneLoginStatus
} from "../../api";
import { t } from "../../i18n";
import { colors, font, radius, spacing } from "../../theme";

// Lets an owner who signed up with email attach a verified phone number so they
// can later sign in with the SMS code on the login screen. Two steps: enter the
// number → receive a code → verify. The number links to this account on the API.
export function PhoneSignInScreen() {
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"enter" | "verify">("enter");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPhoneLoginStatus();
      setLinkedPhone(data.phone);
      if (data.phone) setPhone(data.phone);
      setError(null);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : t("phoneSignin.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sendCode() {
    setSending(true);
    setError(null);
    setInfo(null);
    try {
      const r = await addPhoneLoginRequest(phone.trim());
      if (r.sent) {
        setStep("verify");
        setInfo(t("phoneSignin.codeSent"));
      } else {
        setError(r.message || t("phoneSignin.codeFailed"));
      }
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : t("phoneSignin.codeFailed"));
    } finally {
      setSending(false);
    }
  }

  async function confirm() {
    setConfirming(true);
    setError(null);
    setInfo(null);
    try {
      const r = await addPhoneLoginConfirm({ phone: phone.trim(), code: code.trim() });
      setLinkedPhone(r.phone);
      setStep("enter");
      setCode("");
      setInfo(t("phoneSignin.linked"));
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : t("phoneSignin.codeInvalid"));
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.leaf} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: spacing.md }}>
          <View style={s.iconRow}>
            <View style={s.iconBg}><Text style={s.iconText}>📱</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{t("phoneSignin.title")}</Text>
              <Text style={s.subtitle}>{t("phoneSignin.subtitle")}</Text>
            </View>
          </View>

          {linkedPhone ? <Banner tone="good" title={t("phoneSignin.currentlyLinked")} body={linkedPhone} /> : null}
          {info ? <Banner tone="good" title={info} /> : null}
          {error ? <Banner tone="bad" title={t("common.error")} body={error} /> : null}

          <View>
            <Text style={s.label}>{t("phoneSignin.numberLabel")}</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              editable={step === "enter"}
              placeholder="+15551234567"
              placeholderTextColor={colors.inkMuted}
              style={[s.input, step !== "enter" && s.inputDisabled]}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <Text style={s.help}>{t("phoneSignin.numberHelp")}</Text>
          </View>

          {step === "verify" ? (
            <View>
              <Text style={s.label}>{t("auth.sixDigitCode")}</Text>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/[^0-9]/g, ""))}
                placeholder="123456"
                placeholderTextColor={colors.inkMuted}
                style={s.input}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
          ) : null}

          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {step === "enter" ? (
              <Button
                title={linkedPhone ? t("phoneSignin.updateNumber") : t("phoneSignin.addNumber")}
                onPress={sendCode}
                loading={sending}
                disabled={sending || !phone.trim()}
              />
            ) : (
              <View style={{ gap: spacing.sm }}>
                <Button
                  title={confirming ? t("auth.verifying") : t("phoneSignin.confirm")}
                  onPress={confirm}
                  loading={confirming}
                  disabled={confirming || code.length < 6}
                />
                <Button
                  title={t("common.back")}
                  variant="secondary"
                  onPress={() => {
                    setStep("enter");
                    setCode("");
                    setError(null);
                  }}
                  disabled={confirming}
                />
              </View>
            )}
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40 },
  iconRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBg: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.leafSoft, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 20 },
  title: { color: colors.ink, fontWeight: font.black, fontSize: 18 },
  subtitle: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12, marginTop: 2 },
  label: { color: colors.ink, fontWeight: font.black, fontSize: 13, marginBottom: 6 },
  help: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 11, marginTop: 4 },
  input: {
    minHeight: 50, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.inputBorder,
    fontSize: 15, color: colors.ink, backgroundColor: colors.white, fontWeight: font.bold
  },
  inputDisabled: { backgroundColor: colors.smoke, color: colors.inkSoft }
});
