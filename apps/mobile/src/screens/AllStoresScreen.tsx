import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { formatMoney, formatMoneyExact } from "@smokeshop/shared/utils/money";
import type { OwnerDashboardSummary } from "@smokeshop/shared/types";
import { getOwnerDashboard } from "../api";
import { Banner, Card, Pill } from "../ui";
import { colors, font, radius, spacing } from "../theme";

type Filter = "all" | "closed" | "needs" | "open";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "closed", label: "Closed" },
  { key: "needs", label: "Needs closing" },
  { key: "open", label: "Open" }
];

export function AllStoresScreen() {
  const [summary, setSummary] = useState<OwnerDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async (initial: boolean) => {
    if (initial) setLoading(true);
    try {
      const data = await getOwnerDashboard();
      setSummary(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Could not load stores.");
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

  const stores = summary?.stores ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stores.filter((s) => {
      if (q && !s.storeName.toLowerCase().includes(q)) return false;
      const needsClosing = !s.closedToday && Boolean(s.pastCloseTime);
      if (filter === "closed") return s.closedToday;
      if (filter === "needs") return needsClosing;
      if (filter === "open") return !s.closedToday && !needsClosing;
      return true;
    });
  }, [stores, query, filter]);

  const counts = useMemo(() => {
    let closed = 0, needs = 0, open = 0;
    for (const s of stores) {
      const needsClosing = !s.closedToday && Boolean(s.pastCloseTime);
      if (s.closedToday) closed++;
      else if (needsClosing) needs++;
      else open++;
    }
    return { all: stores.length, closed, needs, open };
  }, [stores]);

  return (
    <ScrollView
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.leaf} />}
    >
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search stores…"
        placeholderTextColor={colors.inkMuted}
        style={s.search}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = counts[f.key];
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[s.chip, active && s.chipActive]}
            >
              <Text style={[s.chipLabel, active && s.chipLabelActive]}>
                {f.label} <Text style={s.chipCount}>{count}</Text>
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ paddingVertical: spacing.xl, alignItems: "center" }}>
          <ActivityIndicator color={colors.leaf} />
        </View>
      ) : null}

      {error ? <Banner tone="bad" title="Could not load" body={error} /> : null}

      {!loading && filtered.length === 0 ? (
        <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
          <Text style={s.emptyTitle}>No stores match</Text>
          <Text style={s.emptyBody}>
            {query ? `Nothing matches "${query}".` : "Try a different filter."}
          </Text>
        </Card>
      ) : null}

      {filtered.map((store) => {
        const needsClosing = !store.closedToday && Boolean(store.pastCloseTime);
        const tone = store.closedToday ? "good" : needsClosing ? "warn" : "plain";
        const status = store.closedToday ? "CLOSED" : needsClosing ? "NEEDS CLOSING" : "OPEN";
        return (
          <Card key={store.id} style={{ gap: spacing.sm }}>
            <View style={s.rowBetween}>
              <Text style={s.cardTitle} numberOfLines={1}>{store.storeName}</Text>
              <Pill label={status} tone={tone} />
            </View>

            <View style={s.miniRow}>
              <View style={s.miniCell}>
                <Text style={s.miniLabel}>Gross</Text>
                <Text style={s.miniValue}>{store.closedToday ? formatMoney(store.totalSales) : "—"}</Text>
              </View>
              <View style={s.miniCell}>
                <Text style={s.miniLabel}>Net</Text>
                <Text style={[s.miniValue, store.netProfit < 0 && { color: colors.warning }]}>
                  {store.closedToday ? formatMoney(store.netProfit) : "—"}
                </Text>
              </View>
              <View style={s.miniCell}>
                <Text style={s.miniLabel}>Cash diff</Text>
                <Text style={[s.miniValue, store.difference < 0 && { color: colors.warning }]}>
                  {store.closedToday ? formatMoneyExact(store.difference) : "—"}
                </Text>
              </View>
            </View>

            <Text style={s.closeTime}>
              {store.closedToday
                ? "Closed today"
                : needsClosing
                  ? "Close not submitted yet"
                  : `Closes at ${store.closeTime ?? "23:30"}`}
            </Text>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  search: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.ink,
    fontWeight: font.bold,
    fontSize: 15
  },
  filterRow: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipLabel: { color: colors.ink, fontWeight: font.black, fontSize: 13 },
  chipLabelActive: { color: colors.white },
  chipCount: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 12 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  cardTitle: { color: colors.ink, fontWeight: font.black, fontSize: 17, flex: 1, minWidth: 0 },
  miniRow: { flexDirection: "row", gap: spacing.sm },
  miniCell: { flex: 1, padding: spacing.md, backgroundColor: colors.smoke, borderRadius: radius.md },
  miniLabel: { color: colors.inkMuted, fontWeight: font.black, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 },
  miniValue: { color: colors.ink, fontWeight: font.black, fontSize: 14, marginTop: 2 },
  closeTime: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12 },
  emptyTitle: { color: colors.ink, fontWeight: font.black, fontSize: 16 },
  emptyBody: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 13, marginTop: 4, textAlign: "center" }
});
