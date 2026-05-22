import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Pill } from "../ui";
import { colors, font, radius, spacing } from "../theme";

const FEATURES = [
  { icon: "⏱", title: "Close in 2 minutes", body: "Upload, count, submit — from your phone." },
  { icon: "📊", title: "Owner sees everything", body: "Sales, closed stores, missing cash in one look." },
  { icon: "🛡", title: "Built for pilots", body: "Secure auth, audit trail, CSV export." }
];

export function LoginScreen({ onOpen }: { onOpen: (s: "owner" | "employee") => void }) {
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
        <Button title="Open Owner View" onPress={() => onOpen("owner")} />
        <Button title="Open Employee View" variant="secondary" onPress={() => onOpen("employee")} />
      </View>

      <Text style={s.legal}>By continuing you agree to the Terms and Privacy Policy.</Text>
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
  legal: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 12, textAlign: "center", marginTop: spacing.lg }
});
