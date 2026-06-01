import { ReactNode } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle
} from "react-native";
import { colors, font, radius, spacing } from "../theme";

type Tone = "plain" | "good" | "bad" | "warn";

const toneBg: Record<Tone, string> = {
  plain: colors.white,
  good: colors.leafSoft,
  bad: colors.warningSoft,
  warn: colors.goldSoft
};
const toneBorder: Record<Tone, string> = {
  plain: colors.border,
  good: colors.leafBorder,
  bad: colors.warningBorder,
  warn: colors.goldBorder
};
const toneText: Record<Tone, string> = {
  plain: colors.ink,
  good: colors.leaf,
  bad: colors.warning,
  warn: colors.gold
};

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[ui.card, style]}>{children}</View>;
}

export function Pill({ label, tone = "plain" }: { label: string; tone?: Tone }) {
  return (
    <View style={[ui.pill, { backgroundColor: toneBg[tone], borderColor: toneBorder[tone] }]}>
      <Text style={[ui.pillText, { color: toneText[tone] }]}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "dark";
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
}) {
  const base: ViewStyle =
    variant === "primary"
      ? ui.btnPrimary
      : variant === "dark"
      ? ui.btnDark
      : ui.btnSecondary;
  const textStyle = variant === "secondary" ? ui.btnSecondaryText : ui.btnPrimaryText;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[ui.btnBase, base, (disabled || loading) && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? <ActivityIndicator color={variant === "secondary" ? colors.ink : colors.white} /> : null}
      {!loading && icon ? <Text style={[textStyle, { fontSize: 20 }]}>{icon}</Text> : null}
      <Text style={textStyle}>{title}</Text>
    </TouchableOpacity>
  );
}

export function MetricCard({
  label,
  value,
  tone = "plain"
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <View
      style={[
        ui.card,
        { padding: spacing.lg, backgroundColor: toneBg[tone], borderColor: toneBorder[tone] }
      ]}
    >
      <Text style={ui.metricLabel}>{label}</Text>
      <Text style={[ui.metricValue, { color: toneText[tone] }]}>{value}</Text>
    </View>
  );
}

export function MoneyInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ marginTop: spacing.sm }}>
      <Text style={ui.inputLabel}>{label}</Text>
      <TextInput
        style={ui.input}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.inkMuted}
      />
    </View>
  );
}

export function Header({
  title,
  subtitle,
  onBack,
  right
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={ui.header}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={ui.backBtn} accessibilityLabel="Back">
            <Text style={ui.backIcon}>‹</Text>
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={ui.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={ui.headerSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

export function StepProgress({ current, steps }: { current: number; steps: string[] }) {
  const pct = ((current + 1) / steps.length) * 100;
  return (
    <View style={ui.progressWrap}>
      <View style={ui.progressTrack}>
        <View style={[ui.progressFill, { width: `${pct}%` }]} />
      </View>
      <View style={ui.stepsRow}>
        {steps.map((label, i) => {
          const done = i < current;
          const cur = i === current;
          const dotColor = cur ? colors.leaf : done ? colors.leafSoft : colors.smoke;
          const dotTextColor = cur ? colors.white : done ? colors.leaf : colors.inkMuted;
          const textColor = cur ? colors.leaf : done ? colors.inkSoft : colors.inkMuted;
          return (
            <View key={label} style={ui.stepItem}>
              <View style={[ui.stepDot, { backgroundColor: dotColor }]}>
                <Text style={[ui.stepDotText, { color: dotTextColor }]}>{done ? "✓" : String(i + 1)}</Text>
              </View>
              <Text style={[ui.stepLabel, { color: textColor }]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function Banner({
  tone,
  title,
  body
}: {
  tone: Tone;
  title: string;
  body?: string;
}) {
  return (
    <View
      style={[
        ui.banner,
        { backgroundColor: toneBg[tone], borderColor: toneBorder[tone] }
      ]}
    >
      <Text style={[ui.bannerTitle, { color: toneText[tone] }]}>{title}</Text>
      {body ? <Text style={ui.bannerBody}>{body}</Text> : null}
    </View>
  );
}

export const ui = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg
  },
  pill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  pillText: { fontWeight: font.black, fontSize: 12, letterSpacing: 0.5 },
  btnBase: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.lg
  },
  btnPrimary: { backgroundColor: colors.leaf },
  btnDark: { backgroundColor: colors.ink },
  btnSecondary: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.ink },
  btnPrimaryText: { color: colors.white, fontWeight: font.black, fontSize: 17 },
  btnSecondaryText: { color: colors.ink, fontWeight: font.black, fontSize: 17 },
  metricLabel: { color: colors.inkSoft, fontWeight: font.black, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  metricValue: { color: colors.ink, fontWeight: font.black, fontSize: 26, marginTop: 4 },
  inputLabel: { color: colors.ink, fontWeight: font.black, fontSize: 14 },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 14,
    fontSize: 20,
    fontWeight: font.black,
    color: colors.ink,
    backgroundColor: colors.white,
    marginTop: 6
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerTitle: { color: colors.ink, fontWeight: font.black, fontSize: 18 },
  headerSubtitle: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12, marginTop: 1 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.smoke,
    alignItems: "center",
    justifyContent: "center"
  },
  backIcon: { fontSize: 24, color: colors.ink, fontWeight: font.black, marginTop: -4 },
  progressWrap: { padding: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  progressTrack: { height: 6, borderRadius: radius.pill, backgroundColor: colors.smoke, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.leaf },
  stepsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md, gap: 4 },
  stepItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
  stepDot: { width: 22, height: 22, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  stepDotText: { fontWeight: font.black, fontSize: 11 },
  stepLabel: { fontWeight: font.black, fontSize: 11, letterSpacing: 0.3 },
  banner: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  bannerTitle: { fontWeight: font.black, fontSize: 16 },
  bannerBody: { color: colors.inkSoft, fontWeight: font.bold, marginTop: 4, fontSize: 13 }
});
