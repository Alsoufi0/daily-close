import { useMemo, useState } from "react";
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
import { ApiError, finishClose, uploadReport } from "../api";
import { uploadMobilePosReport } from "../upload-pos-report";
import { useSession } from "../use-session";
import { Banner, Button, Card, Header, MetricCard, MoneyInput, StepProgress } from "../ui";
import { colors, font, radius, spacing } from "../theme";

type Step = "start" | "upload" | "sales" | "cash" | "expenses" | "done" | "blocked";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "sales", label: "Sales" },
  { key: "cash", label: "Cash" },
  { key: "expenses", label: "Expenses" },
  { key: "done", label: "Finish" }
];

const STEP_TITLES: Record<Step, string> = {
  start: "Ready to close?",
  upload: "Upload POS Report",
  sales: "Check Sales Numbers",
  cash: "Count Cash",
  expenses: "Add Expenses",
  done: "All Done",
  blocked: "Already closed today"
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
          Alert.alert("Camera permission needed", "Allow camera access to take a photo of the POS report.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Photo permission needed", "Allow photo access to upload a POS report.");
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
          Alert.alert("Upload failed", e?.message || "Could not upload the image.");
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
      await finishClose({
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
      });
      setStep("done");
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 400 && /already.*closed/i.test(error.message)) {
        setStep("blocked");
      } else {
        Alert.alert("Could not submit", error?.message || "Try again in a moment.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep("start");
    setReport(initialReport);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header
        title={`Close ${activeStore.storeName}`}
        subtitle={session.profile?.name ? `Hi ${session.profile.name}` : "Follow one simple step"}
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {step !== "start" && step !== "done" && step !== "blocked" ? (
          <StepProgress current={currentIndex} steps={STEPS.map((x) => x.label)} />
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <Text style={s.title}>{STEP_TITLES[step]}</Text>

          {step === "start" ? (
            <>
              <Button title="Start Closing" icon="🧾" onPress={() => setStep("upload")} />
              <Text style={s.helper}>Takes about 2 minutes. Edit any number before submitting.</Text>
            </>
          ) : null}

          {step === "blocked" ? (
            <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg }}>
              <Text style={s.doneIcon}>📒</Text>
              <Text style={s.doneTitle}>This store is already closed for today.</Text>
              <Text style={s.helper}>If you need to fix something, ask the owner to edit it.</Text>
              <Button title="Back to Start" onPress={reset} />
            </View>
          ) : null}

          {step === "upload" ? (
            <>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[s.uploadTile, { borderColor: colors.leaf, backgroundColor: colors.leafSoft }]}
                  onPress={() => pickImage("camera")}
                >
                  <Text style={[s.uploadIcon, { color: colors.leaf }]}>📷</Text>
                  <Text style={[s.uploadText, { color: colors.leaf }]}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[s.uploadTile, { borderColor: colors.inputBorder, backgroundColor: colors.smoke }]}
                  onPress={() => pickImage("library")}
                >
                  <Text style={[s.uploadIcon, { color: colors.ink }]}>📁</Text>
                  <Text style={[s.uploadText, { color: colors.ink }]}>Upload Report</Text>
                </TouchableOpacity>
              </View>
              {loading ? <Banner tone="warn" title="Reading report…" body="Pulling cash, card, total, tax, refunds." /> : null}
            </>
          ) : null}

          {step === "sales" ? (
            <>
              <MoneyInput
                label="Cash Sales"
                value={String(report.cashSales)}
                onChange={(v) => setReport({ ...report, cashSales: Number(v || 0) })}
              />
              <MoneyInput
                label="Card Sales"
                value={String(report.cardSales)}
                onChange={(v) => setReport({ ...report, cardSales: Number(v || 0) })}
              />
              <MoneyInput
                label="Total Sales"
                value={String(report.totalSales)}
                onChange={(v) => setReport({ ...report, totalSales: Number(v || 0) })}
              />
              <MoneyInput
                label="Tax"
                value={String(report.tax)}
                onChange={(v) => setReport({ ...report, tax: Number(v || 0) })}
              />
              <MoneyInput
                label="Refunds"
                value={String(report.refunds)}
                onChange={(v) => setReport({ ...report, refunds: Number(v || 0) })}
              />
              <Button title="Numbers Look Right" onPress={() => setStep("cash")} />
            </>
          ) : null}

          {step === "cash" ? (
            <>
              <MoneyInput label="Cash Counted" value={cashCounted} onChange={setCashCounted} />
              <MoneyInput label="Safe Drop" value={safeDrop} onChange={setSafeDrop} />
              <MetricCard label="Expected Cash" value={formatMoney(result.expectedCash)} />
              <MetricCard
                label="Difference"
                value={formatMoney(result.difference)}
                tone={result.difference < 0 ? "bad" : "good"}
              />
              <Button title="Add Expenses" onPress={() => setStep("expenses")} />
            </>
          ) : null}

          {step === "expenses" ? (
            <>
              <MoneyInput label="Expenses" value={expenses} onChange={setExpenses} />
              <Text style={s.inputLabel}>Notes</Text>
              <TextInput
                style={s.notes}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional"
                placeholderTextColor={colors.inkMuted}
                multiline
              />
              <Button title="Finish Closing" variant="dark" loading={submitting} onPress={submit} />
            </>
          ) : null}

          {step === "done" ? (
            <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg }}>
              <Text style={s.doneIcon}>{result.difference < 0 ? "💵" : "✅"}</Text>
              <Text style={s.doneTitle}>
                {result.difference < 0
                  ? `Cash Shortage: ${formatMoney(result.difference)}`
                  : "Store Closed Successfully"}
              </Text>
              <Text style={s.helper}>Owner dashboard is updated.</Text>
              <Button title="Start Over" onPress={reset} />
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
