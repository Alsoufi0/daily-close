import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountFooter } from "../components/AccountFooter";
import type { SettingsStackParamList } from "../navigation/AppDrawer";
import { supabase } from "../supabase";
import { clearToken } from "../api";
import { t } from "../i18n";
import { colors, font, radius, spacing } from "../theme";

const WEB_BASE = (process.env.EXPO_PUBLIC_APP_URL || "https://dailyclose.us").replace(/\/+$/, "");

type SettingsNav = NativeStackNavigationProp<SettingsStackParamList, "SettingsHome">;

interface Row {
  title: string;
  subtitle: string;
  navigate?: keyof SettingsStackParamList; // native nav within Settings stack
  web?: string; // fallback: opens web in browser
}

function getRows(): Row[] {
  return [
    { title: t("account.changePassword"), subtitle: t("settings.changePasswordSubtitle"), navigate: "ChangePassword" },
    { title: t("phoneSignin.title"), subtitle: t("phoneSignin.listSubtitle"), navigate: "PhoneSignIn" },
    { title: t("settings.whatsappTitle"), subtitle: t("settings.whatsappListSubtitle"), navigate: "WhatsAppSettings" },
    { title: t("common.language"), subtitle: t("settings.languageSubtitle"), navigate: "Language" },
    { title: t("settings.billingTitle"), subtitle: t("settings.billingSubtitle"), web: "/billing" }
  ];
}

export function SettingsScreen() {
  const navigation = useNavigation<SettingsNav>();

  async function handleSignOut() {
    try {
      await clearToken();
      if (supabase) await supabase.auth.signOut();
    } catch {
      /* noop */
    }
  }

  const rows = getRows();
  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.sectionLabel}>{t("settings.accountSection").toUpperCase()}</Text>
      <View style={s.rowGroup}>
        {rows.map((row, i) => {
          const isFirst = i === 0;
          return (
            <TouchableOpacity
              key={row.title}
              onPress={() => {
                if (row.navigate) navigation.navigate(row.navigate);
                else if (row.web) Linking.openURL(`${WEB_BASE}${row.web}`).catch(() => {});
              }}
              style={[s.row, isFirst && s.rowFirst]}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{row.title}</Text>
                <Text style={s.rowSubtitle}>{row.subtitle}</Text>
              </View>
              <Text style={s.rowArrow}>{row.navigate ? "›" : "↗"}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <AccountFooter role="owner" onSignOut={handleSignOut} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  sectionLabel: { color: colors.inkMuted, fontWeight: font.black, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginTop: spacing.sm, marginLeft: spacing.sm },
  rowGroup: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md
  },
  rowFirst: { borderTopWidth: 0 },
  rowTitle: { color: colors.ink, fontWeight: font.black, fontSize: 15 },
  rowSubtitle: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12, marginTop: 2 },
  rowArrow: { color: colors.leaf, fontWeight: font.black, fontSize: 22 }
});
