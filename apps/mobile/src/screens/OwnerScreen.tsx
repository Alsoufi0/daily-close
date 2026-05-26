import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatMoney } from "@smokeshop/shared/utils/money";
import type { OwnerDashboardSummary } from "@smokeshop/shared/types";
import { getOwnerDashboard } from "../api";
import { useSession } from "../use-session";
import { Banner, Card, Header, MetricCard, Pill } from "../ui";
import { colors, font, radius, spacing } from "../theme";
import { t } from "../i18n";

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
  missingCash: 0,
  needsAttention: 0,
  stores: [],
  alerts: []
};

export function OwnerScreen({ onBack }: { onBack: () => void }) {
  const session = useSession();
  const [summary, setSummary] = useState<OwnerDashboardSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOwnerDashboard()
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Could not load dashboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allClosed = summary.storesClosed === summary.totalStores;
  const shortage = summary.stores.find((s) => s.difference < 0);
  const maxSales = useMemo(
    () => Math.max(1, ...summary.stores.map((s) => (s.closedToday ? s.totalSales : 0))),
    [summary.stores]
  );

  return (
    <View style={{ flex: 1 }}>
      <Header title="Today's Store Close" subtitle={today} onBack={onBack} />
      <ScrollView contentContainerStyle={s.content}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pill label="LIVE" tone="good" />
          <Text style={s.subhead}>
            {session.profile?.name ? `Welcome, ${session.profile.name}` : "Welcome back"}
          </Text>
        </View>

        {loading ? (
          <View style={{ paddingVertical: spacing.lg, alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={[s.subhead, { marginTop: spacing.sm }]}>Loading today's data…</Text>
          </View>
        ) : null}

        {error ? (
          <Banner tone="bad" title="Could not load dashboard" body={error} />
        ) : null}

        <View style={s.metricGrid}>
          <MetricCard label={t("dashboard.salesToday")} value={formatMoney(summary.totalSales)} />
          <MetricCard
            label={t("dashboard.storesClosed")}
            value={`${summary.storesClosed}/${summary.totalStores}`}
            tone={allClosed ? "good" : "warn"}
          />
          <MetricCard
            label={t("dashboard.missingCash")}
            value={formatMoney(summary.missingCash)}
            tone={summary.missingCash < 0 ? "bad" : "good"}
          />
          <MetricCard
            label={t("dashboard.needsAttention")}
            value={String(summary.needsAttention)}
            tone={summary.needsAttention === 0 ? "good" : "warn"}
          />
        </View>

        {summary.alerts.length > 0 ? (
          <Banner tone="warn" title={summary.alerts[0].message} body="Call the store or remind the employee." />
        ) : (
          <Banner tone="good" title={t("dashboard.noMissedAlerts")} body="Every assigned store has reported in." />
        )}

        {shortage ? (
          <Banner
            tone="bad"
            title={`${shortage.storeName} is short ${formatMoney(shortage.difference)}`}
            body="Cash counted is lower than expected."
          />
        ) : (
          <Banner tone="good" title={t("dashboard.noCashShortage")} body="Counted cash matches expected for every store." />
        )}

        <Text style={s.sectionTitle}>{t("dashboard.storeComparison")}</Text>
        {summary.stores.map((store) => {
          const barWidth = store.closedToday ? Math.max(6, (store.totalSales / maxSales) * 100) : 0;
          const needsClosing = !store.closedToday && Boolean(store.pastCloseTime);
          const diffTone: "good" | "bad" | "warn" =
            needsClosing ? "warn" : store.difference < 0 ? "bad" : "good";
          return (
            <Card key={store.id} style={{ gap: spacing.md }}>
              <View style={s.rowBetween}>
                <Text style={s.cardTitle}>{store.storeName}</Text>
                <Pill
                  label={store.closedToday ? t("dashboard.closed").toUpperCase() : needsClosing ? t("dashboard.needsClosing").toUpperCase() : t("dashboard.open").toUpperCase()}
                  tone={store.closedToday ? "good" : needsClosing ? "warn" : "good"}
                />
              </View>

              <View>
                <Text style={s.kicker}>{t("dashboard.salesToday")}</Text>
                <Text style={s.bigNumber}>{store.closedToday ? formatMoney(store.totalSales) : "—"}</Text>
                <View style={s.bar}>
                  <View style={[s.barFill, { width: `${barWidth}%` }]} />
                </View>
              </View>

              <View style={s.miniRow}>
                <View style={s.miniCell}>
                  <Text style={s.miniLabel}>Cash</Text>
                  <Text style={s.miniValue}>{store.closedToday ? formatMoney(store.cashSales) : "—"}</Text>
                </View>
                <View style={s.miniCell}>
                  <Text style={s.miniLabel}>Card</Text>
                  <Text style={s.miniValue}>{store.closedToday ? formatMoney(store.cardSales) : "—"}</Text>
                </View>
              </View>

              <Banner
                tone={diffTone}
                title={
                  store.closedToday
                    ? `Cash difference: ${formatMoney(store.difference)}`
                    : needsClosing
                      ? "Closing needed"
                      : `Open - closes ${store.closeTime ?? "23:30"}`
                }
              />
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  subhead: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 13 },
  metricGrid: { gap: spacing.sm },
  sectionTitle: { color: colors.ink, fontWeight: font.black, fontSize: 20, marginTop: spacing.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: colors.ink, fontWeight: font.black, fontSize: 18 },
  kicker: { color: colors.inkSoft, fontWeight: font.black, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 },
  bigNumber: { color: colors.ink, fontWeight: font.black, fontSize: 32, marginTop: 2 },
  bar: { height: 6, backgroundColor: colors.smoke, borderRadius: radius.pill, overflow: "hidden", marginTop: spacing.sm },
  barFill: { height: "100%", backgroundColor: colors.leaf },
  miniRow: { flexDirection: "row", gap: spacing.sm },
  miniCell: { flex: 1, padding: spacing.md, backgroundColor: colors.smoke, borderRadius: radius.md },
  miniLabel: { color: colors.inkSoft, fontWeight: font.black, fontSize: 11, textTransform: "uppercase" },
  miniValue: { color: colors.ink, fontWeight: font.black, fontSize: 18, marginTop: 2 }
});
