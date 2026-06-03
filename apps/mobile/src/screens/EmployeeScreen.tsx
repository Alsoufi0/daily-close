import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { formatMoney, formatMoneyExact, netProfit, toMoney } from "@smokeshop/shared/utils/money";
import type { ParsedPOSReport } from "@smokeshop/shared/types";
import { ApiError, finishClose, generateIdempotencyKey, uploadReport } from "../api";
import { suggestBusinessDate, storeLocalDateToUtcNoon } from "@smokeshop/shared/timezones";
import { QueuedForRetryError } from "../outbox";
import { clearDraft, loadDraft, loadSelectedStoreId, saveDraft, saveSelectedStoreId } from "../persistence";
import { AccountFooter } from "../components/AccountFooter";
import { OfflineBanner } from "../components/OfflineBanner";
import { useSession } from "../use-session";
import { Banner, Button, Card, MetricCard, MoneyInput, StepProgress } from "../ui";
import { DateField } from "../components/DateField";
import { colors, font, radius, spacing } from "../theme";
import { t } from "../i18n";

type Step = "start" | "upload" | "sales" | "cash" | "expenses" | "done" | "blocked";

interface ExpenseRow {
  id: string;
  category: string;
  amount: string;
  description?: string;
}

const EXPENSE_CATEGORIES = [
  { value: "Supplies", labelKey: "closing.expenseSupplies" },
  { value: "Lottery payout", labelKey: "closing.expenseLottery" },
  { value: "Repair", labelKey: "closing.expenseRepair" },
  { value: "Check", labelKey: "closing.expenseCheck" },
  { value: "Cash paid out", labelKey: "closing.expenseCashPaidOut" },
  { value: "Other", labelKey: "closing.expenseOther" }
] as const;

function newExpenseRow(): ExpenseRow {
  const g: any = globalThis as any;
  const id = g.crypto?.randomUUID
    ? g.crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, category: "Supplies", amount: "0" };
}

// STEPS + STEP_TITLES hold translation KEYS, not English. Labels are resolved
// via t() at render time so a language switch re-renders without rebuilding
// these module-level constants.
const STEPS: { key: Step; labelKey: string }[] = [
  { key: "upload", labelKey: "closing.stepShortUpload" },
  { key: "sales", labelKey: "closing.stepShortSales" },
  { key: "cash", labelKey: "closing.stepShortCash" },
  { key: "expenses", labelKey: "closing.stepShortExpenses" },
  { key: "done", labelKey: "closing.stepShortFinish" }
];

const STEP_TITLE_KEYS: Record<Step, string> = {
  start: "closing.ready",
  upload: "closing.upload",
  sales: "closing.sales",
  cash: "closing.cash",
  expenses: "closing.expenses",
  done: "closing.allDone",
  blocked: "closing.alreadyClosed"
};

const initialReport: ParsedPOSReport = {
  parserType: "CLOVER",
  cashSales: 0,
  cardSales: 0,
  totalSales: 0,
  tax: 0,
  refunds: 0,
  discounts: 0,
  confidence: 0
};

export function EmployeeScreen({ onSignOut }: { onSignOut: () => void }) {
  const session = useSession();
  const [step, setStep] = useState<Step>("start");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<ParsedPOSReport>(initialReport);
  const [cashCounted, setCashCounted] = useState("");
  const [safeDrop, setSafeDrop] = useState("0");
  const [expenseItems, setExpenseItems] = useState<ExpenseRow[]>([]);
  const [notes, setNotes] = useState("");
  // The business date the close is filed under. Defaults to the smart-suggested
  // store-local day, but the user confirms/changes it at the Finish step (#2).
  const [businessDate, setBusinessDate] = useState("");

  function goBack() {
    setStep((sCur) =>
      sCur === "sales" ? "upload" : sCur === "cash" ? "sales" : sCur === "expenses" ? "cash" : sCur
    );
  }

  const expensesTotal = useMemo(
    () => expenseItems.reduce((sum, item) => sum + toMoney(item.amount), 0),
    [expenseItems]
  );

  // One idempotency key per CLOSE ATTEMPT, not per submit call. Persists
  // across re-renders, network retries, and the user tapping Submit again
  // after a timeout — so the server can dedupe via the unique constraint on
  // `daily_close.idempotency_key`. Reset in `reset()` when the user starts
  // a fresh close.
  const idempotencyKey = useRef(generateIdempotencyKey());

  // Offline persistence (audit fix #5 phase 1). Mirror the in-progress
  // close to AsyncStorage so a phone restart / app kill / accidental Home
  // tap doesn't lose the employee's work. Restored on cold start.
  const [restored, setRestored] = useState(false);
  const skipNextPersistRef = useRef(true); // skip the very first effect-driven persist (avoids clobbering before restore)

  // Phase 2: if submit hit a network failure and got queued for retry,
  // the "done" screen messaging changes — the close is committed locally
  // but not yet acknowledged by the server.
  const [wasQueued, setWasQueued] = useState(false);

  const result = useMemo(() => {
    // Robust parsing — see toMoney() docstring. Strips commas, currency
    // symbols, NBSP, etc. before Number() so a paste of "1,169.27" or a
    // value from an Android keyboard with a thousands separator doesn't
    // silently collapse to 0 and turn a matched close into a massive
    // fake shortage (the bug behind the "Difference -$1,169 when counted
    // = 1169" report).
    const expectedCash = report.cashSales - report.refunds - expensesTotal;
    const difference = toMoney(cashCounted) + toMoney(safeDrop) - expectedCash;
    return { expectedCash, difference };
  }, [cashCounted, expensesTotal, report.cashSales, report.refunds, safeDrop]);

  const currentIndex = step === "start" || step === "blocked"
    ? -1
    : STEPS.findIndex((s) => s.key === step);

  // Phase 3: explicit store picker for users with multi-store assignments.
  // selectedStoreId is persisted across launches so a user with one store
  // never sees a picker, and a user with several lands on the one they
  // most recently closed.
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [storePickerOpen, setStorePickerOpen] = useState(false);

  // Hydrate the saved selection on mount AND every time the screen comes
  // into focus — so when AllStoresScreen's "Close this store" button
  // saves a new selection and navigates here, we pick it up even though
  // the drawer keeps EmployeeScreen mounted.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadSelectedStoreId().then((saved) => {
        if (cancelled) return;
        if (saved && session.stores.some((s) => s.id === saved)) {
          setSelectedStoreId(saved);
        } else if (session.stores[0]) {
          setSelectedStoreId(session.stores[0].id);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [session.stores])
  );

  const activeStore =
    session.stores.find((s) => s.id === selectedStoreId) ??
    session.stores[0] ??
    (session.profile?.storeId
      ? { id: session.profile.storeId, storeName: "My Store" }
      : { id: "store-1", storeName: "Store #1" });

  function pickStore(storeId: string) {
    setSelectedStoreId(storeId);
    saveSelectedStoreId(storeId);
    setStorePickerOpen(false);
    // Reset the close form when switching stores so we don't carry
    // numbers from Store A into a close for Store B.
    reset();
  }

  const employeeId = session.profile?.employeeId ?? "employee-maya";

  // Restore in-progress close from AsyncStorage on cold start. Only restore
  // drafts for the SAME store the employee is now assigned to (otherwise
  // the saved cashSales / expenses would land in the wrong store).
  useEffect(() => {
    let cancelled = false;
    loadDraft().then((draft) => {
      if (cancelled || !draft) return;
      if (draft.storeId !== activeStore.id) {
        // Different store — discard (employee re-assigned, or test data).
        clearDraft();
        return;
      }
      setStep(draft.step);
      setReport(draft.report);
      setCashCounted(draft.cashCounted);
      setSafeDrop(draft.safeDrop);
      setExpenseItems(draft.expenseItems || []);
      setNotes(draft.notes);
      idempotencyKey.current = draft.idempotencyKey;
      setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, [activeStore.id]);

  // Persist on every meaningful change. Skip the initial render so we don't
  // overwrite the draft we're about to restore. Skip "start" and "done"
  // states — nothing to resume from those.
  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    if (step === "start" || step === "done" || step === "blocked") return;
    saveDraft({
      step,
      storeId: activeStore.id,
      report,
      cashCounted,
      safeDrop,
      expenseItems,
      notes,
      idempotencyKey: idempotencyKey.current
    });
  }, [step, activeStore.id, report, cashCounted, safeDrop, expenseItems, notes]);

  async function pickImage(source: "camera" | "library") {
    setLoading(true);
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t("alerts.cameraNeeded"), t("alerts.cameraNeededBody"));
          return;
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t("alerts.photoNeeded"), t("alerts.photoNeededBody"));
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.6
        });
      }
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      // Preprocess to match the web upload: bake in EXIF orientation, resize the
      // longest edge to ~1800px, and re-encode to JPEG. This fixes iOS HEIC
      // photos, rotated images, and huge/slow uploads — the things that made
      // native OCR return zeros or fail. The base64 output goes straight to the
      // API, which stores it with the service key and runs OCR (no client-side
      // Storage upload, so no RLS error).
      const resize =
        (asset.width ?? 0) >= (asset.height ?? 0) ? { width: 1800 } : { height: 1800 };
      const processed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!processed.base64) throw new Error(t("closing.uploadFailedBody"));

      const parsed = await uploadReport(activeStore.id, processed.base64, "pos-report.jpg", "image/jpeg");
      setReport(parsed);
      setStep("sales");
    } catch (e: any) {
      Alert.alert(t("closing.uploadFailed"), e?.message || t("closing.uploadFailedBody"));
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      // Anchor the close to the STORE's business day (its timezone + close
      // time), not the phone's clock — so a close submitted from a different
      // timezone, or after midnight, still lands on the correct day. Mirrors
      // the web close flow via the shared helpers.
      const tz = (activeStore as { timezone?: string }).timezone;
      const closeTime = (activeStore as { closeTime?: string }).closeTime;
      const dateForClose = businessDate || suggestBusinessDate({ timezone: tz, closeTime });
      await finishClose(
        {
          storeId: activeStore.id,
          employeeId,
          date: storeLocalDateToUtcNoon(dateForClose, tz),
          cashSales: report.cashSales,
          cardSales: report.cardSales,
          totalSales: report.totalSales,
          tax: report.tax,
          refunds: report.refunds,
          discounts: report.discounts,
          countedCash: toMoney(cashCounted),
          safeDropAmount: toMoney(safeDrop),
          expenses: expensesTotal,
          expenseItems: expenseItems
            .filter((item) => toMoney(item.amount) > 0 || item.category === "Other")
            .map((item) => ({
              category: item.category,
              amount: toMoney(item.amount),
              description: item.description?.trim() || undefined
            })),
          notes
        },
        idempotencyKey.current
      );
      // Close succeeded — purge the persisted draft so a fresh app open
      // doesn't restore the just-submitted close.
      await clearDraft();
      setRestored(false);
      setWasQueued(false);
      setStep("done");
    } catch (error: any) {
      if (error instanceof QueuedForRetryError) {
        // Network failure — the close is safely persisted in the outbox
        // (see api.ts:finishClose). It will replay automatically the next
        // time the app opens online. Treat as a soft success: the
        // employee's work isn't lost and they don't need to do anything.
        await clearDraft();
        setRestored(false);
        setWasQueued(true);
        setStep("done");
      } else if (error instanceof ApiError && error.status === 400 && /already.*closed/i.test(error.message)) {
        setStep("blocked");
      } else {
        Alert.alert(t("closing.submitFailed"), error?.message || t("closing.submitFailedBody"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep("start");
    setReport(initialReport);
    setCashCounted("");
    setSafeDrop("0");
    setExpenseItems([]);
    setNotes("");
    // Fresh key for the next close attempt — otherwise the server would
    // return the previous close on the first submit of the new one.
    idempotencyKey.current = generateIdempotencyKey();
    setRestored(false);
    clearDraft();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Drawer's own header gives us title + hamburger; show context here */}
      <View style={s.contextBar}>
        <Text style={s.contextTitle} numberOfLines={1}>
          {t("closing.closeStore")} {activeStore.storeName}
        </Text>
        {session.profile?.name ? (
          <Text style={s.contextSubtitle}>
            {t("closing.headerHi")} {session.profile.name}
          </Text>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <OfflineBanner />
        {/* Multi-store picker — hidden when the user has only one store so
            single-store employees see no UI clutter. Tapping opens a
            sheet listing every store the user is assigned to. */}
        {session.stores.length > 1 ? (
          <Pressable
            onPress={() => setStorePickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Closing for ${activeStore.storeName}. Tap to switch store.`}
            style={s.storePicker}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.storePickerLabel}>{t("closing.closingFor")}</Text>
              <Text style={s.storePickerValue}>{activeStore.storeName}</Text>
            </View>
            <Text style={s.storePickerChevron}>▾</Text>
          </Pressable>
        ) : null}
        {restored ? (
          <Banner tone="warn" title={t("closing.resumedTitle")} body={t("closing.resumedBody")} />
        ) : null}
        {step !== "start" && step !== "done" && step !== "blocked" ? (
          <StepProgress current={currentIndex} steps={STEPS.map((x) => t(x.labelKey))} />
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <View style={s.titleRow}>
            {step === "sales" || step === "cash" || step === "expenses" ? (
              <Pressable onPress={goBack} hitSlop={8} style={s.backBtn} accessibilityLabel={t("common.back")}>
                <Text style={s.backIcon}>←</Text>
              </Pressable>
            ) : null}
            <Text style={s.title}>{t(STEP_TITLE_KEYS[step])}</Text>
          </View>

          {step === "start" ? (
            <>
              <Button title={t("closing.start")} icon="🧾" onPress={() => setStep("upload")} />
              <Text style={s.helper}>{t("closing.about2Minutes")}</Text>
            </>
          ) : null}

          {step === "blocked" ? (
            <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg }}>
              <Text style={s.doneIcon}>📒</Text>
              <Text style={s.doneTitle}>{t("closing.alreadyClosedToday")}</Text>
              <Text style={s.helper}>{t("closing.alreadyClosedHelp")}</Text>
              <Button title={t("closing.backStart")} onPress={reset} />
            </View>
          ) : null}

          {step === "upload" ? (
            <>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[s.uploadTile, { borderColor: colors.leaf, backgroundColor: colors.leafSoft }]}
                  onPress={() => pickImage("camera")}
                  accessibilityRole="button"
                  accessibilityLabel={t("closing.takePhoto")}
                  accessibilityHint={t("alerts.cameraNeededBody")}
                >
                  <Text style={[s.uploadIcon, { color: colors.leaf }]} accessible={false}>📷</Text>
                  <Text style={[s.uploadText, { color: colors.leaf }]}>{t("closing.takePhoto")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[s.uploadTile, { borderColor: colors.inputBorder, backgroundColor: colors.smoke }]}
                  onPress={() => pickImage("library")}
                  accessibilityRole="button"
                  accessibilityLabel={t("closing.uploadReport")}
                  accessibilityHint={t("alerts.photoNeededBody")}
                >
                  <Text style={[s.uploadIcon, { color: colors.ink }]} accessible={false}>📁</Text>
                  <Text style={[s.uploadText, { color: colors.ink }]}>{t("closing.uploadReport")}</Text>
                </TouchableOpacity>
              </View>
              {loading ? <Banner tone="warn" title={t("closing.reading")} body={t("closing.readingBody")} /> : null}
            </>
          ) : null}

          {step === "sales" ? (
            <>
              <MoneyInput
                label={t("closing.cashSales")}
                value={String(report.cashSales)}
                onChange={(v) => setReport({ ...report, cashSales: Number(v || 0) })}
              />
              <MoneyInput
                label={t("closing.cardSales")}
                value={String(report.cardSales)}
                onChange={(v) => setReport({ ...report, cardSales: Number(v || 0) })}
              />
              <MoneyInput
                label={t("closing.totalSales")}
                value={String(report.totalSales)}
                onChange={(v) => setReport({ ...report, totalSales: Number(v || 0) })}
              />
              <MoneyInput
                label={t("closing.tax")}
                value={String(report.tax)}
                onChange={(v) => setReport({ ...report, tax: Number(v || 0) })}
              />
              <MoneyInput
                label={t("closing.refunds")}
                value={String(report.refunds)}
                onChange={(v) => setReport({ ...report, refunds: Number(v || 0) })}
              />
              <Button title={t("closing.numbersRight")} onPress={() => setStep("cash")} />
            </>
          ) : null}

          {step === "cash" ? (
            <>
              <MoneyInput label={t("closing.cashCounted")} value={cashCounted} onChange={setCashCounted} />
              <MoneyInput label={t("closing.safeDrop")} value={safeDrop} onChange={setSafeDrop} />
              {/* Always show cents on Expected + Difference. formatMoney rounds
                  to whole dollars which makes a -$0.27 shortage display as
                  "-$0" and look benign; formatMoneyExact keeps the truth visible. */}
              <MetricCard label={t("closing.expectedCash")} value={formatMoneyExact(result.expectedCash)} />
              <MetricCard
                label={t("closing.difference")}
                value={formatMoneyExact(result.difference)}
                tone={result.difference < 0 ? "bad" : "good"}
              />
              <Button title={t("closing.expenses")} onPress={() => setStep("expenses")} />
            </>
          ) : null}

          {step === "expenses" ? (
            <>
              {expenseItems.length === 0 ? (
                <Text style={s.helper}>{t("closing.noExpenses")}</Text>
              ) : null}
              {expenseItems.map((item, idx) => (
                <View key={item.id} style={s.expenseRow}>
                  <Text style={s.inputLabel}>{t("closing.expenseCategory")}</Text>
                  <View style={s.categoryWrap}>
                    {EXPENSE_CATEGORIES.map((cat) => {
                      const selected = item.category === cat.value;
                      return (
                        <TouchableOpacity
                          key={cat.value}
                          onPress={() => {
                            const next = [...expenseItems];
                            next[idx] = { ...item, category: cat.value };
                            setExpenseItems(next);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          style={[s.categoryChip, selected && s.categoryChipSelected]}
                        >
                          <Text style={[s.categoryChipText, selected && s.categoryChipTextSelected]}>
                            {t(cat.labelKey)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <MoneyInput
                    label={t("closing.expenseAmount")}
                    value={item.amount}
                    onChange={(value) => {
                      const next = [...expenseItems];
                      next[idx] = { ...item, amount: value };
                      setExpenseItems(next);
                    }}
                  />
                  {item.category === "Other" ? (
                    <>
                      <Text style={s.inputLabel}>{t("closing.expenseDescription")}</Text>
                      <TextInput
                        style={s.notes}
                        value={item.description || ""}
                        onChangeText={(value) => {
                          const next = [...expenseItems];
                          next[idx] = { ...item, description: value };
                          setExpenseItems(next);
                        }}
                        placeholder={t("common.optional")}
                        placeholderTextColor={colors.inkMuted}
                      />
                    </>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => setExpenseItems(expenseItems.filter((_, i) => i !== idx))}
                    accessibilityRole="button"
                    accessibilityLabel={t("closing.removeExpense")}
                    style={s.removeBtn}
                  >
                    <Text style={s.removeBtnText}>− {t("closing.removeExpense")}</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <Button
                title={t("closing.addExpense")}
                icon="＋"
                onPress={() => setExpenseItems([...expenseItems, newExpenseRow()])}
              />
              <MetricCard
                label={t("closing.expensesTotal")}
                value={formatMoneyExact(expensesTotal)}
              />
              <MetricCard
                label={t("closing.netProfit")}
                value={formatMoney(
                  netProfit({
                    totalSales: report.totalSales,
                    tax: report.tax,
                    refunds: report.refunds,
                    expenses: expensesTotal
                  })
                )}
              />
              <Text style={s.inputLabel}>{t("closing.notes")}</Text>
              <TextInput
                style={s.notes}
                value={notes}
                onChangeText={setNotes}
                placeholder={t("common.optional")}
                placeholderTextColor={colors.inkMuted}
                multiline
              />
              <DateField
                label={t("closing.businessDate")}
                value={
                  businessDate ||
                  suggestBusinessDate({
                    timezone: (activeStore as { timezone?: string }).timezone,
                    closeTime: (activeStore as { closeTime?: string }).closeTime
                  })
                }
                onChange={setBusinessDate}
                maximumDate={new Date()}
              />
              <Button title={t("closing.finish")} variant="dark" loading={submitting} onPress={submit} />
            </>
          ) : null}

          {step === "done" ? (
            <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg }}>
              <Text style={s.doneIcon}>
                {wasQueued ? "📨" : result.difference < 0 ? "💵" : "✅"}
              </Text>
              <Text style={s.doneTitle}>
                {wasQueued
                  ? t("closing.queuedTitle")
                  : result.difference < 0
                    ? `${t("closing.cashShortage")}: ${formatMoneyExact(result.difference)}`
                    : t("closing.success")}
              </Text>
              <Text style={s.helper}>
                {wasQueued ? t("closing.queuedBody") : t("closing.ownerUpdated")}
              </Text>
              <Button title={t("closing.startOver")} onPress={reset} />
            </View>
          ) : null}
        </Card>
      </ScrollView>

      {/* Store picker sheet — surfaces when the user taps the
          "Closing for: X ▾" pill at the top. Lists every store the user
          is currently assigned to. Picking a store resets the form so
          numbers from Store A don't bleed into a close for Store B. */}
      <Modal
        visible={storePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStorePickerOpen(false)}
      >
        <Pressable style={s.storePickerBackdrop} onPress={() => setStorePickerOpen(false)}>
          <Pressable style={s.storePickerSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={s.storePickerSheetTitle}>{t("closing.pickStore")}</Text>
            <Text style={s.storePickerSheetSubtitle}>{t("closing.pickStoreHelp")}</Text>
            {session.stores.map((store) => {
              const isSelected = store.id === activeStore.id;
              return (
                <TouchableOpacity
                  key={store.id}
                  onPress={() => pickStore(store.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    s.storePickerRow,
                    isSelected && { borderColor: colors.leaf, backgroundColor: colors.leafSoft }
                  ]}
                >
                  <Text style={[s.storePickerRowText, isSelected && { color: colors.leaf }]}>
                    {store.storeName}
                  </Text>
                  {isSelected ? <Text style={s.storePickerCheck}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backBtn: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.smoke, alignItems: "center", justifyContent: "center" },
  backIcon: { color: colors.ink, fontWeight: font.black, fontSize: 20 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  contextBar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  contextTitle: { color: colors.ink, fontWeight: font.black, fontSize: 16 },
  contextSubtitle: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12, marginTop: 2 },
  title: { color: colors.ink, fontWeight: font.black, fontSize: 20 },
  helper: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 13, textAlign: "center" },
  uploadTile: {
    flex: 1,
    minHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: spacing.md
  },
  uploadIcon: { fontSize: 28 },
  uploadText: { fontWeight: font.black, fontSize: 16 },
  inputLabel: { color: colors.ink, fontWeight: font.black, fontSize: 14, marginTop: spacing.sm },
  notes: {
    minHeight: 90,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    padding: spacing.md,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
    marginTop: 6,
    textAlignVertical: "top"
  },
  expenseRow: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  categoryWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.smoke
  },
  categoryChipSelected: { borderColor: colors.leaf, backgroundColor: colors.leafSoft },
  categoryChipText: { color: colors.ink, fontWeight: font.bold, fontSize: 12 },
  categoryChipTextSelected: { color: colors.leaf, fontWeight: font.black },
  removeBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  removeBtnText: { color: colors.warning ?? "#b42318", fontWeight: font.black, fontSize: 13 },
  doneIcon: { fontSize: 56 },
  doneTitle: { color: colors.ink, fontWeight: font.black, fontSize: 22, textAlign: "center" },

  // Multi-store picker (Phase 3)
  storePicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  storePickerLabel: {
    color: colors.inkSoft,
    fontWeight: font.bold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  storePickerValue: {
    color: colors.ink,
    fontWeight: font.black,
    fontSize: 16,
    marginTop: 2
  },
  storePickerChevron: {
    color: colors.inkSoft,
    fontWeight: font.black,
    fontSize: 18
  },
  storePickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 18, 16, 0.45)",
    justifyContent: "flex-end"
  },
  storePickerSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: "70%"
  },
  storePickerSheetTitle: {
    color: colors.ink,
    fontWeight: font.black,
    fontSize: 18
  },
  storePickerSheetSubtitle: {
    color: colors.inkSoft,
    fontWeight: font.bold,
    fontSize: 13,
    marginBottom: spacing.sm
  },
  storePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.white
  },
  storePickerRowText: {
    color: colors.ink,
    fontWeight: font.black,
    fontSize: 15
  },
  storePickerCheck: {
    color: colors.leaf,
    fontWeight: font.black,
    fontSize: 16
  }
});
