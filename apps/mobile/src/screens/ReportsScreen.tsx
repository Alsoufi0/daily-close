import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { formatMoney, formatMoneyExact } from "@smokeshop/shared/utils/money";
import {
  listReceipts,
  listStores,
  ReceiptRow,
  StoreRecord
} from "../api";
import { Banner, Button, Card } from "../ui";
import { colors, font, radius, spacing } from "../theme";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const WEB_BASE = (process.env.EXPO_PUBLIC_APP_URL || "https://dailyclose.us").replace(/\/+$/, "");

export function ReportsScreen() {
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [storeId, setStoreId] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [storesLoading, setStoresLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [openReceipt, setOpenReceipt] = useState<ReceiptRow | null>(null);

  // Initial: load stores, pre-select first
  useEffect(() => {
    let cancelled = false;
    listStores()
      .then((s) => {
        if (cancelled) return;
        setStores(s);
        if (s[0]) setStoreId(s[0].id);
      })
      .catch((err) => !cancelled && setError(err?.message || "Could not load stores."))
      .finally(() => !cancelled && setStoresLoading(false));
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    if (!storeId) return;
    if (from && !DATE_REGEX.test(from)) { setError("From date must be YYYY-MM-DD."); return; }
    if (to && !DATE_REGEX.test(to)) { setError("To date must be YYYY-MM-DD."); return; }
    setLoading(true);
    setError(null);
    try {
      const rows = await listReceipts({ storeId, from: from || undefined, to: to || undefined });
      setReceipts(rows);
    } catch (err: any) {
      setError(err?.message || "Could not load receipts.");
    } finally {
      setLoading(false);
    }
  }, [storeId, from, to]);

  // Auto-load whenever the store changes (debounced via the effect dep)
  useEffect(() => {
    if (storeId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const selectedStore = useMemo(() => stores.find((s) => s.id === storeId), [stores, storeId]);

  if (storesLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.leaf} />
      </View>
    );
  }

  if (stores.length === 0) {
    return (
      <View style={{ padding: spacing.lg }}>
        <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
          <Text style={s.emptyTitle}>No stores yet</Text>
          <Text style={s.emptyBody}>Add a store first to see its reports.</Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.filters}>
        <Text style={s.label}>Store</Text>
        <TouchableOpacity onPress={() => setShowStorePicker(true)} style={s.storeBtn}>
          <Text style={s.storeBtnText} numberOfLines={1}>
            {selectedStore?.storeName ?? "Pick a store"}
          </Text>
          <Text style={s.storeChevron}>▾</Text>
        </TouchableOpacity>

        <View style={s.dateRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>From</Text>
            <TextInput
              value={from}
              onChangeText={setFrom}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.inkMuted}
              style={s.dateInput}
              autoCapitalize="none"
              maxLength={10}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>To</Text>
            <TextInput
              value={to}
              onChangeText={setTo}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.inkMuted}
              style={s.dateInput}
              autoCapitalize="none"
              maxLength={10}
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Apply" onPress={load} disabled={loading} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Bulk export"
              variant="secondary"
              onPress={() => {
                if (!storeId) return;
                const params = new URLSearchParams();
                params.set("storeId", storeId);
                if (from) params.set("from", from);
                if (to) params.set("to", to);
                Linking.openURL(`${WEB_BASE}/owner/receipts?${params.toString()}`).catch(() => {});
              }}
            />
          </View>
        </View>
      </View>

      {error ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Banner tone="bad" title="Couldn't load" body={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={{ paddingVertical: spacing.xl, alignItems: "center" }}>
          <ActivityIndicator color={colors.leaf} />
        </View>
      ) : receipts.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <Text style={s.emptyTitle}>No reports in range</Text>
            <Text style={s.emptyBody}>Try widening the date range or pick another store.</Text>
          </Card>
        </View>
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.leaf} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => setOpenReceipt(item)} style={s.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.rowTitle} numberOfLines={1}>{item.closeDate}</Text>
                <Text style={s.rowSubtitle} numberOfLines={1}>
                  {item.employeeName}
                </Text>
              </View>
              {item.dailyClose ? (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.rowAmount}>{formatMoney(item.dailyClose.totalSales)}</Text>
                  <Text style={[
                    s.rowDiff,
                    item.dailyClose.difference < 0 && { color: colors.warning }
                  ]}>
                    {item.dailyClose.difference >= 0 ? "+" : ""}{formatMoneyExact(item.dailyClose.difference)}
                  </Text>
                </View>
              ) : (
                <Text style={s.rowMuted}>—</Text>
              )}
            </Pressable>
          )}
        />
      )}

      {/* Store picker modal */}
      <Modal visible={showStorePicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowStorePicker(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Choose store</Text>
            <TouchableOpacity onPress={() => setShowStorePicker(false)} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={stores}
            keyExtractor={(st) => st.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { setStoreId(item.id); setShowStorePicker(false); }}
                style={({ pressed }) => [s.pickerRow, pressed && { backgroundColor: colors.smoke }]}
              >
                <Text style={[s.pickerLabel, item.id === storeId && { color: colors.leaf }]}>{item.storeName}</Text>
                {item.id === storeId ? <Text style={s.pickerCheck}>✓</Text> : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* Receipt detail modal */}
      <Modal visible={!!openReceipt} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpenReceipt(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={1}>
              {openReceipt?.storeName} · {openReceipt?.closeDate}
            </Text>
            <TouchableOpacity onPress={() => setOpenReceipt(null)} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}>
            {openReceipt?.imageUrl ? (
              <Image
                source={{ uri: openReceipt.imageUrl }}
                style={{ width: "100%", aspectRatio: 0.75, borderRadius: radius.md, backgroundColor: colors.smoke }}
                resizeMode="contain"
              />
            ) : null}
            {openReceipt?.dailyClose ? (
              <Card style={{ gap: spacing.sm }}>
                <DetailRow label="Status" value={openReceipt.dailyClose.status} />
                <DetailRow label="Total sales" value={formatMoney(openReceipt.dailyClose.totalSales)} />
                <DetailRow label="Cash" value={formatMoney(openReceipt.dailyClose.cashSales)} />
                <DetailRow label="Card" value={formatMoney(openReceipt.dailyClose.cardSales)} />
                <DetailRow
                  label="Cash difference"
                  value={formatMoneyExact(openReceipt.dailyClose.difference)}
                  tone={openReceipt.dailyClose.difference < 0 ? "bad" : "good"}
                />
              </Card>
            ) : null}
            <Card style={{ gap: spacing.xs }}>
              <Text style={s.metaLabel}>Submitted by</Text>
              <Text style={s.metaValue}>{openReceipt?.employeeName}</Text>
              <Text style={[s.metaLabel, { marginTop: spacing.sm }]}>Uploaded</Text>
              <Text style={s.metaValue}>
                {openReceipt ? new Date(openReceipt.createdAt).toLocaleString() : ""}
              </Text>
            </Card>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  const color = tone === "bad" ? colors.warning : tone === "good" ? colors.leaf : colors.ink;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={[s.metaValue, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  filters: { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { color: colors.ink, fontWeight: font.black, fontSize: 12, marginBottom: 4 },
  storeBtn: {
    flexDirection: "row", alignItems: "center",
    minHeight: 48, paddingHorizontal: 14,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.inputBorder,
    backgroundColor: colors.white
  },
  storeBtnText: { flex: 1, color: colors.ink, fontWeight: font.bold, fontSize: 15 },
  storeChevron: { color: colors.inkMuted, fontWeight: font.black, fontSize: 14 },
  dateRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  dateInput: {
    minHeight: 44, paddingHorizontal: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.inputBorder,
    backgroundColor: colors.white,
    fontSize: 14, color: colors.ink, fontWeight: font.bold
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, backgroundColor: colors.white,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border
  },
  rowTitle: { color: colors.ink, fontWeight: font.black, fontSize: 15 },
  rowSubtitle: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12, marginTop: 2 },
  rowAmount: { color: colors.ink, fontWeight: font.black, fontSize: 16 },
  rowDiff: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12, marginTop: 2 },
  rowMuted: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 14 },
  emptyTitle: { color: colors.ink, fontWeight: font.black, fontSize: 16 },
  emptyBody: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 13, marginTop: 4, textAlign: "center" },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  modalTitle: { color: colors.ink, fontWeight: font.black, fontSize: 18, flex: 1 },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.smoke },
  closeText: { color: colors.ink, fontWeight: font.black, fontSize: 18 },
  pickerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerLabel: { flex: 1, color: colors.ink, fontWeight: font.bold, fontSize: 15 },
  pickerCheck: { color: colors.leaf, fontWeight: font.black, fontSize: 18 },
  metaLabel: { color: colors.inkMuted, fontWeight: font.black, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 },
  metaValue: { color: colors.ink, fontWeight: font.black, fontSize: 15 }
});
