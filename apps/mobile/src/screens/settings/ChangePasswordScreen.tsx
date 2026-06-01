import { useState } from "react";
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
import { Banner, Button, Card } from "../../ui";
import { supabase } from "../../supabase";
import { t } from "../../i18n";
import { colors, font, radius, spacing } from "../../theme";

export function ChangePasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (password.length < 8) { setError(t("account.pwTooShort")); return; }
    if (password !== confirm) { setError(t("account.pwMismatch")); return; }
    if (!supabase) { setError(t("account.supabaseNotConfigured")); return; }

    setStatus("loading");
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      setStatus("idle");
      return;
    }
    setStatus("done");
    setPassword("");
    setConfirm("");
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: spacing.md }}>
          <View style={s.iconRow}>
            <View style={s.iconBg}><Text style={s.iconText}>🔒</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{t("account.changePassword")}</Text>
              <Text style={s.subtitle}>{t("account.useAtLeast8")}</Text>
            </View>
          </View>

          {status === "done" ? (
            <Banner tone="good" title={t("account.passwordUpdated")} body={t("account.useNewPassword")} />
          ) : null}

          {error ? <Banner tone="bad" title={t("common.error")} body={error} /> : null}

          <View>
            <Text style={s.label}>{t("account.newPassword")}</Text>
            <View style={s.inputRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.inkMuted}
                style={[s.input, { flex: 1 }]}
                secureTextEntry={!show}
                autoCapitalize="none"
                autoComplete="new-password"
              />
              <TouchableOpacity onPress={() => setShow(!show)} style={s.eyeBtn}>
                <Text style={s.eyeText}>{show ? "🙈" : "👁"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <Text style={s.label}>{t("account.confirmNewPassword")}</Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="••••••••"
              placeholderTextColor={colors.inkMuted}
              style={s.input}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoComplete="new-password"
            />
          </View>

          <Button
            title={status === "loading" ? t("account.updating") : t("account.updatePassword")}
            onPress={submit}
            loading={status === "loading"}
            disabled={status === "loading" || !password || !confirm}
          />
          {status === "loading" ? <ActivityIndicator color={colors.leaf} /> : null}
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
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  input: {
    minHeight: 50, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.inputBorder,
    fontSize: 15, color: colors.ink, backgroundColor: colors.white, fontWeight: font.bold
  },
  eyeBtn: { width: 50, height: 50, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.smoke },
  eyeText: { fontSize: 18 }
});
