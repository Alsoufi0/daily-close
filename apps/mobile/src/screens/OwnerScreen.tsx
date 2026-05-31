import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { formatMoney, formatMoneyExact } from "@smokeshop/shared/utils/money";
import type { OwnerDashboardSummary } from "@smokeshop/shared/types";
import { getOwnerDashboard } from "../api";
import { useSession } from "../use-session";
import { AccountFooter } from "../components/AccountFooter";
import { Banner, Button, Card, Header, Pill } from "../ui";
import { colors, font, radius, spacing } from "../theme";
import { t } from "../i18n";

const WEB_BASE = (process.env.EXPO_PUBLIC_APP_URL || "https://dailyclose.us").replace(/\/+$/, "");

function openWeb(path: string) {
  Linking.openURL(`${WEB_BASE}${path}`).catch(() => {});
}

const today = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric"
});

const EMPTY_SUMMARY: OwnerDashboardSummary = {
  date: new Date().toISOString().slice(0, 10),
  storesClosed: 0,
  totalStores: 0,
  totalSales: 0,
  totalExpenses: 0,
  totalNet: 0,
  missingCash: 0,
  needsAttention: 0,
  stores: [],
  alerts: []
};

export function OwnerScreen({
  onSignOut,
  onCloseStore
}: {
  onSignOut: () => void;
  onCloseStore: () => void;
}) {
  const session = useSession();
  const [summary, setSummary] = useState<OwnerDashboardSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial: boolean) => {
    if (initial) setLoading(true);
    try {
      const data = await getOwnerDashboard();
      setSummary(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || t("dashboard.loadFailed"));
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  }, [load]);

  const allClosed = summary.storesClosed === summary.totalStores;
  const shortage = summary.stores.find((s) => s.difference < 0);
  const maxSales = useMemo(
    () => Math.max(1, ...summary.stores.map((s) => (s.closedToday ? s.totalSales : 0))),
    [summary.stores]
  );

  const ownerName = session.profile?.name || t("dashboard.fallbackName");
  const netColor = summary.totalNet < 0 ? colors.warning : colors.ink;
  const visibleStores = summary.stores.slice(0, 3);
  const moreStores = summary.stores.length > 3 ? summary.stores.length - 3 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={t("dashboard.title")} subtitle={today} />
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.leaf} />}
      >
        {/* Welcome line — small, leaf-colored, like web's top row */}
        <View style={s.welcomeRow}>
          <Text style={s.welcome} numberOfLines={1}>
            {t("dashboard.welcome")} {ownerName}
          </Text>
          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing}
            style={[s.refreshBtn, refreshing && { opacity: 0.5 }]}
            accessibilityLabel="Refresh"
          >
            {refreshing ? <ActivityIndicator size="small" color={colors.ink} /> : <Text style={s.refreshIcon}>⟳</Text>}
          </TouchableOpacity>
        </View>

        {/* Primary CTA — owner can close a store from their phone too */}
        <Button title="Close a store" icon="🧾" onPress={onCloseStore} />

        {/* Secondary navigation — open the web for things mobile doesn't natively cover yet */}
        <View style={s.navRow}>
          <TouchableOpacity onPress={() => openWeb("/stores")} style={s.navTile}>
            <Text style={s.navIcon}>🏪</Text>
            <Text style={s.navLabel}>All stores</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openWeb("/admin/stores")} style={s.navTile}>
            <Text style={s.navIcon}>⚙️</Text>
            <Text style={s.navLabel}>Admin</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openWeb("/owner/receipts")} style={s.navTile}>
            <Text style={s.navIcon}>📄</Text>
            <Text style={s.navLabel}>Reports</Text>
          </TouchableOpacity>
        </View>

        {loading && !summary.totalStores ? (
          <View style={{ paddingVertical: spacing.xl, alignItems: "center" }}>
            <ActivityIndicator color={colors.leaf} />
            <Text style={[s.welcome, { marginTop: spacing.sm, color: colors.inkSoft }]}>
              {t("dashboard.loadingToday")}
            </Text>
          </View>
        ) : null}

        {error ? (
          <Banner tone="bad" title={t("dashboard.loadFailed")} body={error} />
        ) : null}

        {/* Hero: Net Profit headline + Gross/Expenses subtitle + Stores-closed ring */}
        <Card style={s.heroCard}>
          <View style={s.heroTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.heroKicker}>{t("dashboard.netProfit")}</Text>
              <Text style={[s.heroNet, { color: netColor }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(summary.totalNet)}
              </Text>
              <View style={s.heroSubRow}>
                <Text style={s.heroSubItem}>
                  <Text style={s.heroSubLabel}>{t("dashboard.grossSales")} </Text>
                  <Text style={s.heroSubValue}>{formatMoney(summary.totalSales)}</Text>
                </Text>
                <Text style={s.heroDot}> · </Text>
                <Text style={s.heroSubItem}>
                  <Text style={s.heroSubLabel}>{t("dashboard.expenses")} </Text>
                  <Text style={s.heroSubValue}>{formatMoney(summary.totalExpenses)}</Text>
                </Text>
              </View>
            </View>
            <ProgressRing
              value={summary.storesClosed}
              total={summary.totalStores}
              tone={allClosed ? "good" : summary.storesClosed === 0 ? "neutral" : "warn"}
            />
          </View>
          <View style={s.chipRow}>
            <StatusChip
              tone={summary.missingCash < 0 ? "bad" : "good"}
              label={t("dashboard.missingCash")}
              value={formatMoneyExact(summary.missingCash)}
            />
            <StatusChip
              tone={summary.needsAttention === 0 ? "good" : "warn"}
              label={t("dashboard.needsAttention")}
              value={String(summary.needsAttention)}
            />
          </View>
        </Card>

        {/* Conditional alerts — only render when there's a real problem.
            Web does the same to save vertical space when everything's fine. */}
        {summary.alerts.length > 0 ? (
          <Banner tone="warn" title={summary.alerts[0].message} body={t("dashboard.callStore")} />
        ) : null}
        {shortage ? (
          <Banner
            tone="bad"
            title={`${shortage.storeName} ${t("dashboard.isShort")} ${formatMoneyExact(shortage.difference)}`}
            body={t("dashboard.cashLower")}
          />
        ) : null}

        <Text style={s.sectionTitle}>{t("dashboard.storeComparison")}</Text>

        {/* Horizontal snap-scroll store cards (mirrors web's mobile pattern) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          decelerationRate="fast"
          snapToInterval={STORE_CARD_WIDTH + spacing.sm}
          contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
          style={{ marginHorizontal: -spacing.lg, paddingLeft: spacing.lg }}
        >
          {visibleStores.map((store) => {
            const barWidth = store.closedToday ? Math.max(6, (store.totalSales / maxSales) * 100) : 0;
            const needsClosing = !store.closedToday && Boolean(store.pastCloseTime);
            const diffTone: "good" | "bad" | "warn" =
              needsClosing ? "warn" : store.difference < 0 ? "bad" : "good";
            return (
              <Card key={store.id} style={s.storeCard}>
                <View style={s.rowBetween}>
                  <Text style={s.cardTitle} numberOfLines={1}>{store.storeName}</Text>
                  <Pill
                    label={
                      store.closedToday
                        ? t("dashboard.closed").toUpperCase()
                        : needsClosing
                          ? t("dashboard.needsClosing").toUpperCase()
                          : t("dashboard.open").toUpperCase()
                    }
                    tone={store.closedToday ? "good" : needsClosing ? "warn" : "plain"}
                  />
                </View>

                <View style={{ marginTop: spacing.md }}>
                  <Text style={s.kicker}>{t("dashboard.salesToday")}</Text>
                  <Text style={s.bigNumber}>{store.closedToday ? formatMoney(store.totalSales) : "—"}</Text>
                  <View style={s.bar}>
                    <View style={[s.barFill, { width: `${barWidth}%` }]} />
                  </View>
                </View>

                <View style={s.miniRow}>
                  <View style={s.miniCell}>
                    <Text style={s.miniLabel}>{t("common.cash")}</Text>
                    <Text style={s.miniValue}>{store.closedToday ? formatMoney(store.cashSales) : "—"}</Text>
                  </View>
                  <View style={s.miniCell}>
                    <Text style={s.miniLabel}>{t("common.card")}</Text>
                    <Text style={s.miniValue}>{store.closedToday ? formatMoney(store.cardSales) : "—"}</Text>
                  </View>
                </View>

                {store.closedToday ? (
                  <View style={s.miniRow}>
                    <View style={s.miniCell}>
                      <Text style={s.miniLabel}>{t("dashboard.expenses")}</Text>
                      <Text style={s.miniValue}>{formatMoney(store.expenses)}</Text>
                    </View>
                    <View style={s.miniCell}>
                      <Text style={s.miniLabel}>{t("dashboard.netProfit")}</Text>
                      <Text style={[s.miniValue, store.netProfit < 0 && { color: colors.warning }]}>
                        {formatMoney(store.netProfit)}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <Banner
                  tone={diffTone}
                  title={
                    store.closedToday
                      ? `${t("dashboard.cashDifference")}: ${formatMoneyExact(store.difference)}`
                      : needsClosing
                        ? t("dashboard.closeNotSubmitted")
                        : `${t("dashboard.closeDueAt")} ${store.closeTime ?? "23:30"}`
                  }
                />
              </Card>
            );
          })}
        </ScrollView>

        {moreStores > 0 ? (
          <TouchableOpacity onPress={() => openWeb("/stores")} style={s.viewAllRow}>
            <View>
              <Text style={s.viewAllText}>View all {summary.totalStores} stores</Text>
              <Text style={s.viewAllHint}>Opens in browser · or swipe cards →</Text>
            </View>
            <Text style={s.viewAllArrow}>→</Text>
          </TouchableOpacity>
        ) : null}

        <AccountFooter role="owner" onSignOut={onSignOut} />
      </ScrollView>
    </View>
  );
}

// Pure-RN progress ring — donut-style fill for stores-closed. No SVG dep:
// uses a rotated/clipped circle trick with two stacked Views. For tighter
// fidelity later we can swap to react-native-svg (Expo SDK 52 ships it).
function ProgressRing({
  value,
  total,
  tone
}: {
  value: number;
  total: number;
  tone: "good" | "warn" | "neutral";
}) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const ringColor = tone === "good" ? colors.leaf : tone === "warn" ? colors.gold : colors.inkMuted;
  return (
    <View style={ringStyles.wrap}>
      <View style={[ringStyles.track, { borderColor: ringColor + "26" /* ~15% */ }]} />
      <View
        style={[
          ringStyles.fill,
          { borderTopColor: ringColor, borderRightColor: pct > 0.25 ? ringColor : "transparent",
            borderBottomColor: pct > 0.5 ? ringColor : "transparent",
            borderLeftColor: pct > 0.75 ? ringColor : "transparent",
            transform: [{ rotate: `${pct * 360}deg` }] }
        ]}
      />
      <View style={ringStyles.center}>
        <Text style={ringStyles.fraction}>
          {value}<Text style={ringStyles.fractionSlash}>/{total}</Text>
        </Text>
      </View>
    </View>
  );
}

function StatusChip({
  tone,
  label,
  value
}: {
  tone: "good" | "bad" | "warn";
  label: string;
  value: string;
}) {
  const bg = tone === "good" ? colors.leafSoft : tone === "bad" ? colors.warningSoft : colors.goldSoft;
  const border = tone === "good" ? colors.leafBorder : tone === "bad" ? colors.warningBorder : colors.goldBorder;
  const text = tone === "good" ? colors.leaf : tone === "bad" ? colors.warning : colors.gold;
  return (
    <View style={[s.chip, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[s.chipLabel, { color: text }]}>{label.toUpperCase()}</Text>
      <Text style={[s.chipValue, { color: text }]}>{value}</Text>
    </View>
  );
}

const STORE_CARD_WIDTH = 300;

const s = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  welcomeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  welcome: { color: colors.leaf, fontWeight: font.black, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, flex: 1, minWidth: 0 },
  refreshBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center"
  },
  refreshIcon: { color: colors.ink, fontWeight: font.black, fontSize: 20, marginTop: -2 },
  navRow: { flexDirection: "row", gap: spacing.sm },
  navTile: {
    flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
    alignItems: "center", gap: 4
  },
  navIcon: { fontSize: 20 },
  navLabel: { color: colors.ink, fontWeight: font.black, fontSize: 12, textAlign: "center" },
  heroCard: { gap: spacing.md, paddingVertical: spacing.lg },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  heroKicker: { color: colors.inkMuted, fontWeight: font.black, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 },
  heroNet: { color: colors.ink, fontWeight: font.black, fontSize: 40, marginTop: 4, letterSpacing: -0.5 },
  heroSubRow: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.sm, alignItems: "center" },
  heroSubItem: { fontSize: 13 },
  heroSubLabel: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 13 },
  heroSubValue: { color: colors.ink, fontWeight: font.black, fontSize: 13 },
  heroDot: { color: colors.inkMuted, fontWeight: font.bold },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 10 },
  chipLabel: { fontWeight: font.black, fontSize: 10, letterSpacing: 0.5 },
  chipValue: { fontWeight: font.black, fontSize: 12 },
  sectionTitle: { color: colors.ink, fontWeight: font.black, fontSize: 22, marginTop: spacing.md, letterSpacing: -0.3 },
  storeCard: { width: STORE_CARD_WIDTH, gap: spacing.sm },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  cardTitle: { color: colors.ink, fontWeight: font.black, fontSize: 18, flex: 1, minWidth: 0 },
  kicker: { color: colors.inkMuted, fontWeight: font.black, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 },
  bigNumber: { color: colors.ink, fontWeight: font.black, fontSize: 28, marginTop: 2, letterSpacing: -0.3 },
  bar: { height: 6, backgroundColor: colors.smoke, borderRadius: radius.pill, overflow: "hidden", marginTop: spacing.sm },
  barFill: { height: "100%", backgroundColor: colors.leaf },
  miniRow: { flexDirection: "row", gap: spacing.sm },
  miniCell: { flex: 1, padding: spacing.md, backgroundColor: colors.smoke, borderRadius: radius.md },
  miniLabel: { color: colors.inkMuted, fontWeight: font.black, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 },
  miniValue: { color: colors.ink, fontWeight: font.black, fontSize: 16, marginTop: 2 },
  viewAllRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md
  },
  viewAllText: { color: colors.ink, fontWeight: font.black, fontSize: 14 },
  viewAllHint: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 12, marginTop: 2 },
  viewAllArrow: { color: colors.leaf, fontWeight: font.black, fontSize: 20 }
});

const RING_SIZE = 84;
const RING_BORDER = 8;
const ringStyles = StyleSheet.create({
  wrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center"
  },
  track: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_BORDER
  },
  fill: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_BORDER,
    borderColor: "transparent"
  },
  center: { alignItems: "center", justifyContent: "center" },
  fraction: { color: colors.ink, fontWeight: font.black, fontSize: 18 },
  fractionSlash: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 13 }
});
