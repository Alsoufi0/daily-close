import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
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
  icon: keyof typeof Feather.glyphMap;
  navigate?: keyof SettingsStackParamList; // native nav within Settings stack
  web?: string; // opens the web page in the browser
}

function accountRows(): Row[] {
  const rows: Row[] = [
    { title: t("account.changePassword"), subtitle: t("settings.changePasswordSubtitle"), icon: "lock", navigate: "ChangePassword" },
    { title: t("phoneSignin.title"), subtitle: t("phoneSignin.listSubtitle"), icon: "smartphone", navigate: "PhoneSignIn" },
    { title: t("settings.whatsappTitle"), subtitle: t("settings.whatsappListSubtitle"), icon: "message-circle", navigate: "WhatsAppSettings" },
    { title: t("common.language"), subtitle: t("settings.languageSubtitle"), icon: "globe", navigate: "Language" }
  ];
  // Apple Guideline 3.1.1: no external billing/purchase entry point on iOS.
  // iOS owners manage their subscription on the website; Android keeps the link.
  if (Platform.OS !== "ios") {
    rows.push({ title: t("settings.billingTitle"), subtitle: t("settings.billingSubtitle"), icon: "credit-card", web: "/billing" });
  }
  return rows;
}

function helpRows(): Row[] {
  return [
    { title: t("marketing.navTutorials"), subtitle: t("settings.tutorialsSubtitle"), icon: "play-circle", web: "/tutorials" },
    { title: t("marketing.navHowItWorks"), subtitle: t("settings.howSubtitle"), icon: "help-circle", web: "/how-it-works" }
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

  function renderGroup(rows: Row[]) {
    return (
      <View style={s.rowGroup}>
        {rows.map((row, i) => (
          <TouchableOpacity
            key={row.title}
            onPress={() => {
              if (row.navigate) navigation.navigate(row.navigate);
              else if (row.web) Linking.openURL(`${WEB_BASE}${row.web}`).catch(() => {});
            }}
            style={[s.row, i === 0 && s.rowFirst]}
          >
            <View style={s.rowIcon}>
              <Feather name={row.icon} size={18} color={colors.leaf} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{row.title}</Text>
              <Text style={s.rowSubtitle}>{row.subtitle}</Text>
            </View>
            <Feather name={row.navigate ? "chevron-right" : "external-link"} size={18} color={colors.inkMuted} />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.sectionLabel}>{t("settings.accountSection").toUpperCase()}</Text>
      {renderGroup(accountRows())}

      <Text style={s.sectionLabel}>{t("settings.helpSection").toUpperCase()}</Text>
      {renderGroup(helpRows())}

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
  rowIcon: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.leafSoft, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.ink, fontWeight: font.black, fontSize: 15 },
  rowSubtitle: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12, marginTop: 2 }
});
