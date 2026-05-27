import { useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { formatMoney } from "@smokeshop/shared/utils/money";
import type { ParsedPOSReport } from "@smokeshop/shared/types";
import { ApiError, finishClose, generateIdempotencyKey, uploadReport } from "../api";
import { uploadMobilePosReport } from "../upload-pos-report";
import { useSession } from "../use-session";
import { Banner, Button, Card, Header, MetricCard, MoneyInput, StepProgress } from "../ui";
import { colors, font, radius, spacing } from "../theme";
import { t } from "../i18n";

type Step = "start" | "upload" | "sales" | "cash" | "expenses" | "done" | "blocked";

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

export function EmployeeScreen({ onBack }: { onBack: () => void }) {
  const session = useSession();
  const [step, setStep] = useState<Step>("start");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<ParsedPOSReport>(initialReport);
  const [cashCounted, setCashCounted] = useState("2390");
  const [safeDrop, setSafeDrop] = useState("0");
  const [expenses, setExpenses] = useState("0");
  const [notes, setNotes] = useState("");

  // One idempotency key per CLOSE ATTEMPT, not per submit call. Persists
  // across re-renders, network retries, and the user tapping Submit again
  // after a timeout — so the server can dedupe via the unique constraint on
  // `daily_close.idempotency_key`. Reset in `reset()` when the user starts
  // a fresh close.
  const idempotencyKey = useRef(generateIdempotencyKey());

  const result = useMemo(() => {
    const expectedCash = report.cashSales - report.refunds - Number(expenses || 0);
    const difference = Number(cashCounted || 0) + Number(safeDrop || 0) - expectedCash;
    return { expectedCash, difference };
  }, [cashCounted, expenses, report.cashSales, report.refunds, safeDrop]);

  const currentIndex = step === "start" || step === "blocked"
    ? -1
    : STEPS.findIndex((s) => s.key === step);

  const activeStore = session.stores[0] ?? (session.profile?.storeId
    ? { id: session.profile.storeId, storeName: "My Store" }
    : { id: "store-1", storeName: "Store #1" });
  const employeeId = session.profile?.employeeId ?? "employee-maya";

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

      try {
        await uploadMobilePosReport(activeStore.id, {
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileName: asset.fileName
        });
      } catch (e: any) {
        // Upload optional in dev (no Supabase). Carry on with mock parse.
        if (process.env.EXPO_PUBLIC_SUPABASE_URL) {
          Alert.alert(t("closing.uploadFailed"), e?.message || t("closing.uploadFailedBody"));
          return;
        }
      }

      const parsed = await uploadReport();
      setReport(parsed);
      setStep("sales");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      await finishClose(
        {
          storeId: activeStore.id,
          employeeId,
          date: new Date().toISOString(),
          cashSales: report.cashSales,
          cardSales: report.cardSales,
          totalSales: report.totalSales,
          tax: report.tax,
          refunds: report.refunds,
          discounts: report.discounts,
          countedCash: Number(cashCounted || 0),
          safeDropAmount: Number(safeDrop || 0),
          expenses: Number(expenses || 0),
          notes
        },
        idempotencyKey.current
      );
      setStep("done");
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 400 && /already.*closed/i.test(error.message)) {
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
    // Fresh key for the next close attempt — otherwise the server would
    // return the previous close on the first submit of the new one.
    idempotencyKey.current = generateIdempotencyKey();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header
        title={`${t("closing.closeStore")} ${activeStore.storeName}`}
        subtitle={session.profile?.name ? `${t("closing.headerHi")} ${session.profile.name}` : t("closing.headerStep")}
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {step !== "start" && step !== "done" && step !== "blocked" ? (
          <StepProgress current={currentIndex} steps={STEPS.map((x) => t(x.labelKey))} />
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <Text style={s.title}>{t(STEP_TITLE_KEYS[step])}</Text>

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
              <MetricCard label={t("closing.expectedCash")} value={formatMoney(result.expectedCash)} />
              <MetricCard
                label={t("closing.difference")}
                value={formatMoney(result.difference)}
                tone={result.difference < 0 ? "bad" : "good"}
              />
              <Button title={t("closing.expenses")} onPress={() => setStep("expenses")} />
            </>
          ) : null}

          {step === "expenses" ? (
            <>
              <MoneyInput label={t("closing.expenses")} value={expenses} onChange={setExpenses} />
              <Text style={s.inputLabel}>{t("closing.notes")}</Text>
              <TextInput
                style={s.notes}
                value={notes}
                onChangeText={setNotes}
                placeholder={t("common.optional")}
                placeholderTextColor={colors.inkMuted}
                multiline
              />
              <Button title={t("closing.finish")} variant="dark" loading={submitting} onPress={submit} />
            </>
          ) : null}

          {step === "done" ? (
            <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg }}>
              <Text style={s.doneIcon}>{result.difference < 0 ? "💵" : "✅"}</Text>
              <Text style={s.doneTitle}>
                {result.difference < 0
                  ? `${t("closing.cashShortage")}: ${formatMoney(result.difference)}`
                  : t("closing.success")}
              </Text>
              <Text style={s.helper}>{t("closing.ownerUpdated")}</Text>
              <Button title={t("closing.startOver")} onPress={reset} />
            </View>
          ) : null}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
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
  doneIcon: { fontSize: 56 },
  doneTitle: { color: colors.ink, fontWeight: font.black, fontSize: 22, textAlign: "center" }
});
