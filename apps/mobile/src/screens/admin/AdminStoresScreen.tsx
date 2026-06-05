import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { getBrowserTimeZone, getSupportedTimeZones } from "@smokeshop/shared/timezones";
import {
  ApiError,
  createStore,
  CreateStoreInput,
  deleteStore,
  listStores,
  StoreRecord,
  updateStore
} from "../../api";
import { Button, Card } from "../../ui";
import { SkeletonRow } from "../../ui/Skeleton";
import { TimeField } from "../../components/TimeField";
import { t } from "../../i18n";
import { colors, font, radius, spacing } from "../../theme";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function AdminStoresScreen() {
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingStore, setEditingStore] = useState<StoreRecord | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async (initial: boolean) => {
    if (initial) setLoading(true);
    try {
      const s = await listStores();
      setStores(s);
      setError(null);
    } catch (err: any) {
      setError(err?.message || t("admin.loadStoresFailed"));
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

  function confirmDelete(store: StoreRecord) {
    Alert.alert(
      t("admin.removeStoreConfirm").replace("{store}", store.storeName),
      t("admin.removeStoreBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteStore(store.id);
              await load(false);
            } catch (err: any) {
              Alert.alert(t("admin.removeStoreFailed"), err?.message || t("common.tryAgain"));
            }
          }
        }
      ]
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t("admin.stores")}</Text>
          <Text style={s.headerSubtitle}>{t("admin.storesHelp")}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={s.newBtn}>
          <Text style={s.newBtnText}>+ {t("admin.newStore")}</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        </View>
      ) : null}

      {loading && stores.length === 0 ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          {[0, 1, 2].map((i) => <SkeletonRow key={i} />)}
        </View>
      ) : !loading && stores.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <Text style={s.emptyTitle}>{t("admin.noStores")}</Text>
            <Text style={s.emptyBody}>{t("admin.noStoresAddFirst")}</Text>
          </Card>
        </View>
      ) : (
        <FlatList
          data={stores}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.leaf} />}
          renderItem={({ item }) => (
            <StoreRow
              store={item}
              onEdit={() => setEditingStore(item)}
              onDelete={() => confirmDelete(item)}
            />
          )}
        />
      )}

      <StoreFormModal
        visible={showCreate}
        mode="create"
        onClose={() => setShowCreate(false)}
        onSaved={async () => {
          setShowCreate(false);
          await load(false);
        }}
      />

      <StoreFormModal
        visible={!!editingStore}
        mode="edit"
        initial={editingStore ?? undefined}
        onClose={() => setEditingStore(null)}
        onSaved={async () => {
          setEditingStore(null);
          await load(false);
        }}
      />
    </View>
  );
}

function StoreRow({
  store,
  onEdit,
  onDelete
}: {
  store: StoreRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={s.row}>
      <View style={s.storeIcon}>
        <Text style={s.storeIconText}>🏪</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.storeName} numberOfLines={1}>{store.storeName}</Text>
        <Text style={s.storeMeta} numberOfLines={2}>
          {t("dashboard.closesAt")} {store.closeTime ?? "23:30"}
          {store.timezone ? ` · ${store.timezone}` : ""}
          {store.address ? ` · ${store.address}` : ""}
        </Text>
      </View>
      <TouchableOpacity onPress={onEdit} style={s.actionBtn} accessibilityLabel={t("admin.editStore")}>
        <Text style={s.editIcon}>✏️</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} style={s.actionBtn} accessibilityLabel={t("admin.removeStore")}>
        <Text style={s.deleteIcon}>🗑</Text>
      </TouchableOpacity>
    </View>
  );
}

function StoreFormModal({
  visible,
  mode,
  initial,
  onClose,
  onSaved
}: {
  visible: boolean;
  mode: "create" | "edit";
  initial?: StoreRecord;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const browserTz = useMemo(() => getBrowserTimeZone(), []);
  const allTimeZones = useMemo(() => getSupportedTimeZones(), []);

  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [closeTime, setCloseTime] = useState("23:30");
  const [timezone, setTimezone] = useState(browserTz);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tzPickerOpen, setTzPickerOpen] = useState(false);
  const [tzQuery, setTzQuery] = useState("");

  // Reset/seed when opened
  useEffect(() => {
    if (!visible) return;
    setStoreName(initial?.storeName ?? "");
    setAddress(initial?.address ?? "");
    setCloseTime(initial?.closeTime ?? "23:30");
    setTimezone(initial?.timezone ?? browserTz);
    setFormError(null);
  }, [visible, initial, browserTz]);

  async function submit() {
    if (!storeName.trim()) {
      setFormError(t("admin.storeNameRequired"));
      return;
    }
    if (!TIME_REGEX.test(closeTime)) {
      setFormError(t("admin.closeTimeInvalid"));
      return;
    }
    // Mirror web: adding a store updates the monthly bill, so confirm the
    // billing impact before creating it.
    if (mode === "create") {
      const ok = await new Promise<boolean>((resolve) => {
        Alert.alert(
          t("admin.newStore"),
          t("admin.addStoreBillingConfirm"),
          [
            { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
            { text: t("admin.createStore"), onPress: () => resolve(true) }
          ],
          { onDismiss: () => resolve(false) }
        );
      });
      if (!ok) return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const input: CreateStoreInput = {
        storeName: storeName.trim(),
        address: address.trim() || undefined,
        closeTime,
        timezone
      };
      if (mode === "create") {
        await createStore(input);
      } else if (initial) {
        await updateStore(initial.id, input);
      }
      await onSaved();
    } catch (err: any) {
      setFormError(err instanceof ApiError ? err.message : err?.message || t("admin.saveStoreFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  const filteredTz = useMemo(() => {
    const q = tzQuery.trim().toLowerCase();
    if (!q) return allTimeZones;
    return allTimeZones.filter((z) => z.toLowerCase().includes(q));
  }, [allTimeZones, tzQuery]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.wrap}>
        <View style={modal.header}>
          <Text style={modal.title}>{mode === "create" ? t("admin.newStore") : `${t("common.edit")} ${initial?.storeName ?? ""}`}</Text>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
            <Text style={modal.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={modal.content} keyboardShouldPersistTaps="handled">
          {formError ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{formError}</Text>
            </View>
          ) : null}

          <Field label={t("admin.storeName")}>
            <TextInput
              value={storeName}
              onChangeText={setStoreName}
              placeholder={t("admin.storeNamePlaceholder")}
              placeholderTextColor={colors.inkMuted}
              style={modal.input}
              autoFocus={mode === "create"}
            />
          </Field>

          <Field label={t("admin.addressOptional")}>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder={t("admin.addressPlaceholder")}
              placeholderTextColor={colors.inkMuted}
              style={modal.input}
            />
          </Field>

          <Field label={t("admin.dailyCloseTime")}>
            <TimeField value={closeTime} onChange={setCloseTime} />
            <Text style={modal.help}>{t("admin.closeTimeHelp")}</Text>
          </Field>

          <Field label={t("admin.timezone")}>
            <TouchableOpacity style={modal.input} onPress={() => setTzPickerOpen(true)}>
              <Text style={modal.inputText} numberOfLines={1}>
                {timezone}
                {timezone === browserTz ? ` (${t("admin.detectedTimezone")})` : ""}
              </Text>
            </TouchableOpacity>
            <Text style={modal.help}>{t("admin.timezoneHelp")}</Text>
          </Field>
        </ScrollView>

        <View style={modal.footer}>
          <View style={{ flex: 1 }}>
            <Button title={t("common.cancel")} variant="secondary" onPress={onClose} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title={submitting ? t("admin.saving") : mode === "create" ? t("admin.createStore") : t("admin.saveChanges")}
              onPress={submit}
              loading={submitting}
              disabled={submitting}
            />
          </View>
        </View>

        {/* Timezone picker — nested modal so it overlays the form */}
        <Modal visible={tzPickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTzPickerOpen(false)}>
          <View style={modal.wrap}>
            <View style={modal.header}>
              <Text style={modal.title}>{t("admin.chooseTimezone")}</Text>
              <TouchableOpacity onPress={() => setTzPickerOpen(false)} style={modal.closeBtn}>
                <Text style={modal.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: spacing.lg }}>
              <TextInput
                value={tzQuery}
                onChangeText={setTzQuery}
                placeholder={t("admin.searchTimezones")}
                placeholderTextColor={colors.inkMuted}
                style={modal.input}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filteredTz}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setTimezone(item);
                    setTzPickerOpen(false);
                    setTzQuery("");
                  }}
                  style={({ pressed }) => [tzPicker.row, pressed && { backgroundColor: colors.smoke }]}
                >
                  <Text style={[tzPicker.label, timezone === item && { color: colors.leaf }]}>
                    {item}
                  </Text>
                  {item === browserTz ? <Text style={tzPicker.deviceTag}>{t("admin.yourDevice").toUpperCase()}</Text> : null}
                  {timezone === item ? <Text style={tzPicker.check}>✓</Text> : null}
                </Pressable>
              )}
            />
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={modal.label}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  headerTitle: { color: colors.ink, fontWeight: font.black, fontSize: 22, letterSpacing: -0.3 },
  headerSubtitle: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12, marginTop: 2 },
  newBtn: { backgroundColor: colors.leaf, paddingHorizontal: 14, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  newBtnText: { color: colors.white, fontWeight: font.black, fontSize: 14 },
  loadingText: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 13, marginTop: spacing.sm },
  emptyTitle: { color: colors.ink, fontWeight: font.black, fontSize: 16 },
  emptyBody: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 13, marginTop: 4, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md
  },
  storeIcon: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.leafSoft,
    alignItems: "center", justifyContent: "center"
  },
  storeIconText: { fontSize: 18 },
  storeName: { color: colors.ink, fontWeight: font.black, fontSize: 15 },
  storeMeta: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 11, marginTop: 2 },
  actionBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.smoke },
  editIcon: { fontSize: 16 },
  deleteIcon: { fontSize: 16 },
  errorBox: { backgroundColor: colors.warningSoft, borderColor: colors.warningBorder, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.warning, fontWeight: font.bold, fontSize: 13 }
});

const modal = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white
  },
  title: { color: colors.ink, fontWeight: font.black, fontSize: 18, flex: 1 },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.smoke },
  closeText: { color: colors.ink, fontWeight: font.black, fontSize: 18 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  label: { color: colors.ink, fontWeight: font.black, fontSize: 13, marginBottom: 6 },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.white,
    fontWeight: font.bold,
    justifyContent: "center"
  },
  inputText: { fontSize: 15, color: colors.ink, fontWeight: font.bold },
  help: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 11, marginTop: 4 },
  footer: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white
  }
});

const tzPicker = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  label: { color: colors.ink, fontWeight: font.bold, fontSize: 14, flex: 1 },
  deviceTag: { color: colors.leaf, fontWeight: font.black, fontSize: 10, letterSpacing: 0.5 },
  check: { color: colors.leaf, fontWeight: font.black, fontSize: 18 }
});
