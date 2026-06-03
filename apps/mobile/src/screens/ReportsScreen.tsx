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
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import { formatMoney, formatMoneyExact } from "@smokeshop/shared/utils/money";
import {
  getReceiptsZipDownloadInfo,
  getReportExportDownloadInfo,
  listReceipts,
  listStores,
  ReceiptRow,
  StoreRecord
} from "../api";
import { Banner, Button, Card } from "../ui";
import { DateField } from "../components/DateField";
import { SkeletonRow } from "../ui/Skeleton";
import { t } from "../i18n";
import { colors, font, radius, spacing } from "../theme";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZE = 20;

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
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [allStores, setAllStores] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  // Initial: load stores, pre-select first
  useEffect(() => {
    let cancelled = false;
    listStores()
      .then((s) => {
        if (cancelled) return;
        setStores(s);
        if (s[0]) setStoreId(s[0].id);
      })
      .catch((err) => !cancelled && setError(err?.message || t("admin.loadStoresFailed")))
      .finally(() => !cancelled && setStoresLoading(false));
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    if (!storeId) return;
    if (from && !DATE_REGEX.test(from)) { setError(t("reports.dateInvalidFrom")); return; }
    if (to && !DATE_REGEX.test(to)) { setError(t("reports.dateInvalidTo")); return; }
    setLoading(true);
    setError(null);
    try {
      const rows = await listReceipts({ storeId, from: from || undefined, to: to || undefined });
      setReceipts(rows);
    } catch (err: any) {
      setError(err?.message || t("reports.loadFailed"));
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

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [storeId, from, to]);

  async function downloadZip() {
    if (!storeId) return;
    setDownloadingZip(true);
    try {
      const { url, headers } = await getReceiptsZipDownloadInfo({
        storeId,
        from: from || undefined,
        to: to || undefined
      });
      const dateStamp = new Date().toISOString().slice(0, 10);
      const fileName = `receipts-${dateStamp}.zip`;
      const dest = `${FileSystem.cacheDirectory}${fileName}`;
      const dl = await FileSystem.downloadAsync(url, dest, { headers });
      if (dl.status !== 200) {
        throw new Error(`Download failed (HTTP ${dl.status})`);
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(dl.uri, {
          mimeType: "application/zip",
          dialogTitle: t("reports.bulkExport"),
          UTI: "public.zip-archive"
        });
      } else {
        Alert.alert(t("reports.bulkExport"), t("reports.downloadedTo").replace("{path}", dl.uri));
      }
    } catch (err: any) {
      Alert.alert(t("reports.downloadFailed"), err?.message || t("common.tryAgain"));
    } finally {
      setDownloadingZip(false);
    }
  }

  async function downloadExport(type: "csv" | "pdf") {
    if (!allStores && !storeId) return;
    setExporting(type);
    try {
      // Always send explicit yyyy-MM-dd dates. A blank date makes the backend
      // default to "today", which silently exports an empty report — so blank
      // here means "all history → today", not nothing.
      const today = new Date().toISOString().slice(0, 10);
      const exFrom = from && DATE_REGEX.test(from) ? from : "2020-01-01";
      const exTo = to && DATE_REGEX.test(to) ? to : today;
      const { url, headers } = await getReportExportDownloadInfo(type, {
        storeId: allStores ? undefined : storeId,
        from: exFrom,
        to: exTo
      });
      const fileName = `daily-close-${exFrom}_${exTo}.${type}`;
      const dest = `${FileSystem.cacheDirectory}${fileName}`;
      const dl = await FileSystem.downloadAsync(url, dest, { headers });
      if (dl.status !== 200) throw new Error(`Download failed (HTTP ${dl.status})`);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(dl.uri, {
          mimeType: type === "csv" ? "text/csv" : "application/pdf",
          dialogTitle: t("common.export")
        });
      } else {
        Alert.alert(t("common.export"), t("reports.downloadedTo").replace("{path}", dl.uri));
      }
    } catch (err: any) {
      Alert.alert(t("reports.downloadFailed"), err?.message || t("common.tryAgain"));
    } finally {
      setExporting(null);
    }
  }

  async function downloadReceiptImage(r: ReceiptRow) {
    if (!r.imageUrl) return;
    setDownloadingReceipt(true);
    try {
      const ext = (r.imageUrl.match(/\.(jpe?g|png|webp)(\?|$)/i)?.[1] || "jpg").toLowerCase();
      const fileName = `receipt-${r.closeDate}-${r.id}.${ext}`;
      const dest = `${FileSystem.cacheDirectory}${fileName}`;
      const dl = await FileSystem.downloadAsync(r.imageUrl, dest);
      if (dl.status !== 200) throw new Error(`Download failed (HTTP ${dl.status})`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dl.uri, {
          mimeType: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
          dialogTitle: t("reports.download")
        });
      } else {
        Alert.alert(t("common.export"), t("reports.downloadedTo").replace("{path}", dl.uri));
      }
    } catch (err: any) {
      Alert.alert(t("reports.downloadFailed"), err?.message || t("common.tryAgain"));
    } finally {
      setDownloadingReceipt(false);
    }
  }

  const selectedStore = useMemo(() => stores.find((s) => s.id === storeId), [stores, storeId]);
  const visibleReceipts = receipts.slice(0, visibleCount);
  const hasMore = visibleCount < receipts.length;

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
          <Text style={s.emptyTitle}>{t("admin.noStores")}</Text>
          <Text style={s.emptyBody}>{t("reports.noStoresBody")}</Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.filters}>
        <Text style={s.label}>{t("common.store")}</Text>
        <TouchableOpacity onPress={() => setShowStorePicker(true)} style={s.storeBtn}>
          <Text style={s.storeBtnText} numberOfLines={1}>
            {selectedStore?.storeName ?? t("reports.pickStore")}
          </Text>
          <Text style={s.storeChevron}>▾</Text>
        </TouchableOpacity>

        <View style={s.dateRow}>
          <View style={{ flex: 1 }}>
            <DateField
              label={t("reports.from")}
              value={from}
              onChange={setFrom}
              onClear={() => setFrom("")}
              maximumDate={new Date()}
            />
          </View>
          <View style={{ flex: 1 }}>
            <DateField
              label={t("reports.to")}
              value={to}
              onChange={setTo}
              onClear={() => setTo("")}
              maximumDate={new Date()}
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button title={t("reports.apply")} onPress={load} disabled={loading} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title={downloadingZip ? t("common.downloading") : t("reports.bulkExport")}
              variant="secondary"
              onPress={downloadZip}
              loading={downloadingZip}
              disabled={downloadingZip || !storeId}
            />
          </View>
        </View>

        <TouchableOpacity onPress={() => setAllStores((v) => !v)} style={s.allStoresRow}>
          <View style={[s.checkbox, allStores && s.checkboxOn]}>
            {allStores ? <Text style={s.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={s.allStoresLabel}>{t("reports.exportAllStores")}</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              title={exporting === "csv" ? t("common.downloading") : t("reports.exportCsv")}
              variant="secondary"
              onPress={() => downloadExport("csv")}
              loading={exporting === "csv"}
              disabled={!!exporting || (!allStores && !storeId)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title={exporting === "pdf" ? t("common.downloading") : t("reports.exportPdf")}
              variant="secondary"
              onPress={() => downloadExport("pdf")}
              loading={exporting === "pdf"}
              disabled={!!exporting || (!allStores && !storeId)}
            />
          </View>
        </View>
      </View>

      {error ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Banner tone="bad" title={t("common.error")} body={error} />
        </View>
      ) : null}

      {loading ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
        </View>
      ) : receipts.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <Text style={s.emptyTitle}>{t("reports.empty")}</Text>
            <Text style={s.emptyBody}>{t("reports.emptyBody")}</Text>
          </Card>
        </View>
      ) : (
        <FlatList
          data={visibleReceipts}
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
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity onPress={() => setVisibleCount((c) => c + PAGE_SIZE)} style={s.showMoreBtn}>
                <Text style={s.showMoreText}>
                  {t("common.showMore")}  ({receipts.length - visibleCount})
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* Store picker modal */}
      <Modal visible={showStorePicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowStorePicker(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{t("reports.chooseStore")}</Text>
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
            {openReceipt?.imageUrl ? (
              <Button
                title={downloadingReceipt ? t("common.downloading") : t("reports.download")}
                variant="secondary"
                onPress={() => openReceipt && downloadReceiptImage(openReceipt)}
                loading={downloadingReceipt}
                disabled={downloadingReceipt}
              />
            ) : null}
            {openReceipt?.dailyClose ? (
              <Card style={{ gap: spacing.sm }}>
                <DetailRow label={t("reports.status")} value={openReceipt.dailyClose.status} />
                <DetailRow label={t("dashboard.totalSales")} value={formatMoney(openReceipt.dailyClose.totalSales)} />
                <DetailRow label={t("common.cash")} value={formatMoney(openReceipt.dailyClose.cashSales)} />
                <DetailRow label={t("common.card")} value={formatMoney(openReceipt.dailyClose.cardSales)} />
                <DetailRow
                  label={t("dashboard.cashDifference")}
                  value={formatMoneyExact(openReceipt.dailyClose.difference)}
                  tone={openReceipt.dailyClose.difference < 0 ? "bad" : "good"}
                />
              </Card>
            ) : null}
            <Card style={{ gap: spacing.xs }}>
              <Text style={s.metaLabel}>{t("reports.submittedBy")}</Text>
              <Text style={s.metaValue}>{openReceipt?.employeeName}</Text>
              <Text style={[s.metaLabel, { marginTop: spacing.sm }]}>{t("reports.uploaded")}</Text>
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
  metaValue: { color: colors.ink, fontWeight: font.black, fontSize: 15 },
  showMoreBtn: {
    paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md
  },
  showMoreText: { color: colors.leaf, fontWeight: font.black, fontSize: 14 },
  allStoresRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.inputBorder,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.white
  },
  checkboxOn: { backgroundColor: colors.leaf, borderColor: colors.leaf },
  checkboxMark: { color: colors.white, fontWeight: font.black, fontSize: 14 },
  allStoresLabel: { color: colors.ink, fontWeight: font.bold, fontSize: 14 }
});
