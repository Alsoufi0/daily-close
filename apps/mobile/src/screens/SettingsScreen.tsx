import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AccountFooter } from "../components/AccountFooter";
import { colors, font, radius, spacing } from "../theme";

const WEB_BASE = (process.env.EXPO_PUBLIC_APP_URL || "https://dailyclose.us").replace(/\/+$/, "");

function openWeb(path: string) {
  Linking.openURL(`${WEB_BASE}${path}`).catch(() => {});
}

interface Row {
  title: string;
  subtitle: string;
  webPath: string;
}

const ROWS: Row[] = [
  { title: "Change password", subtitle: "Update your sign-in password", webPath: "/account/password" },
  { title: "WhatsApp alerts", subtitle: "Phone number + alert preferences", webPath: "/account/whatsapp" },
  { title: "Billing & subscription", subtitle: "Manage your Daily Close subscription", webPath: "/billing" },
  { title: "Language", subtitle: "Coming soon — switch app language", webPath: "/account" }
];

/**
 * Settings page — for now each row opens the equivalent web page in the
 * system browser (Apple-safe). Will be migrated to native screens one by
 * one in follow-up commits (password change → WhatsApp → language picker).
 */
export function SettingsScreen() {
  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.sectionLabel}>ACCOUNT</Text>
      <View style={s.rowGroup}>
        {ROWS.map((row, i) => (
          <TouchableOpacity
            key={row.title}
            onPress={() => openWeb(row.webPath)}
            style={[s.row, i === 0 && s.rowFirst, i === ROWS.length - 1 && s.rowLast]}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{row.title}</Text>
              <Text style={s.rowSubtitle}>{row.subtitle}</Text>
            </View>
            <Text style={s.rowArrow}>↗</Text>
          </TouchableOpacity>
        ))}
      </View>

      <AccountFooter role="owner" onSignOut={() => openWeb("/login?expired=1")} />
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
  rowLast: {},
  rowTitle: { color: colors.ink, fontWeight: font.black, fontSize: 15 },
  rowSubtitle: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12, marginTop: 2 },
  rowArrow: { color: colors.leaf, fontWeight: font.black, fontSize: 18 }
});
