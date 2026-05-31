import { Linking, StyleSheet, Text, View } from "react-native";
import { Button, Card } from "../ui";
import { colors, font, spacing } from "../theme";

const WEB_BASE = (process.env.EXPO_PUBLIC_APP_URL || "https://dailyclose.us").replace(/\/+$/, "");

/**
 * Generic placeholder shown for screens the native rebuild hasn't shipped
 * yet. Tapping the CTA opens the equivalent web page in the system browser
 * — Apple-safe (vs in-app WebView) and lets the user complete the task.
 *
 * Each placeholder will be replaced with a real native screen in
 * follow-up commits.
 */
export function ComingSoonScreen({
  title,
  description,
  webPath,
  webLabel
}: {
  title: string;
  description: string;
  webPath: string;
  webLabel: string;
}) {
  return (
    <View style={s.wrap}>
      <Card style={{ gap: spacing.md, alignItems: "center", paddingVertical: spacing.xl }}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.body}>{description}</Text>
        <Text style={s.note}>
          The native version is on the way. For now, the same page is one tap away in your browser.
        </Text>
        <Button title={webLabel} onPress={() => Linking.openURL(`${WEB_BASE}${webPath}`).catch(() => {})} />
      </Card>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, backgroundColor: colors.bg },
  title: { color: colors.ink, fontWeight: font.black, fontSize: 22, letterSpacing: -0.3, textAlign: "center" },
  body: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 14, textAlign: "center", lineHeight: 20 },
  note: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 12, textAlign: "center", marginTop: spacing.md }
});
