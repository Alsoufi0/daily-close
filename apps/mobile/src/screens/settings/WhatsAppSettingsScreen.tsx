import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { Banner, Button, Card } from "../../ui";
import {
  ApiError,
  getWhatsAppSettings,
  sendWhatsAppTest,
  updateWhatsAppSettings,
  WhatsAppSettings
} from "../../api";
import { t } from "../../i18n";
import { colors, font, radius, spacing } from "../../theme";

const DEFAULT_SETTINGS: WhatsAppSettings = {
  whatsappPhone: null,
  whatsappAlertsEnabled: false,
  whatsappCloseAlertsEnabled: false,
  whatsappReportsEnabled: false
};

export function WhatsAppSettingsScreen() {
  const [settings, setSettings] = useState<WhatsAppSettings>(DEFAULT_SETTINGS);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWhatsAppSettings();
      setSettings(data);
      setPhone(data.whatsappPhone ?? "");
      setError(null);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : t("settings.whatsappServerNotReady"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const updated = await updateWhatsAppSettings({
        ...settings,
        whatsappPhone: phone.trim() || null
      });
      setSettings(updated);
      setPhone(updated.whatsappPhone ?? "");
      setInfo(t("settings.saved"));
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : t("settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setError(null);
    setInfo(null);
    try {
      const result = await sendWhatsAppTest();
      if (result.sent) setInfo(t("settings.testSent"));
      else setError(result.message || t("settings.testFailed"));
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : t("settings.testFailed"));
    } finally {
      setTesting(false);
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
            <View style={s.iconBg}><Text style={s.iconText}>💬</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{t("settings.whatsappTitle")}</Text>
              <Text style={s.subtitle}>{t("settings.whatsappSubtitle")}</Text>
            </View>
          </View>

          {info ? <Banner tone="good" title={info} /> : null}
          {error ? <Banner tone="bad" title={t("common.error")} body={error} /> : null}

          <View>
            <Text style={s.label}>{t("settings.whatsappPhone")}</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+15551234567"
              placeholderTextColor={colors.inkMuted}
              style={s.input}
              keyboardType="phone-pad"
            />
            <Text style={s.help}>{t("settings.whatsappPhoneHelp")}</Text>
          </View>

          <ToggleRow
            label={t("settings.missedAlerts")}
            description={t("settings.missedAlertsDesc")}
            value={settings.whatsappAlertsEnabled}
            onChange={(v) => setSettings({ ...settings, whatsappAlertsEnabled: v })}
          />

          <ToggleRow
            label={t("settings.closeAlerts")}
            description={t("settings.closeAlertsDesc")}
            value={settings.whatsappCloseAlertsEnabled}
            onChange={(v) => setSettings({ ...settings, whatsappCloseAlertsEnabled: v })}
          />

          <ToggleRow
            label={t("settings.weeklyMonthlyReports")}
            description={t("settings.weeklyMonthlyReportsDesc")}
            value={settings.whatsappReportsEnabled}
            onChange={(v) => setSettings({ ...settings, whatsappReportsEnabled: v })}
          />

          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title={saving ? t("common.saving") : t("common.save")} onPress={save} loading={saving} disabled={saving} />
            <Button title={testing ? t("common.sending") : t("settings.sendTest")} variant="secondary" onPress={test} loading={testing} disabled={testing || !phone.trim()} />
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable onPress={() => onChange(!value)} style={s.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        <Text style={s.toggleDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.leaf, false: colors.inputBorder }}
        thumbColor={colors.white}
      />
    </Pressable>
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
  toggleRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border
  },
  toggleLabel: { color: colors.ink, fontWeight: font.black, fontSize: 14 },
  toggleDescription: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12, marginTop: 2 }
});
