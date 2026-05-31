import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  inviteEmployee
} from "../api";
import { Banner, Button, Card } from "../ui";
import { t } from "../i18n";
import { useSession } from "../use-session";
import { colors, font, radius, spacing } from "../theme";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

type Step = "store" | "employee" | "done";

/**
 * First-run owner setup. Mirrors web's `/setup` two-step wizard:
 *   Step 1 — create the first store (name, address, close time, timezone)
 *   Step 2 — invite the first employee (skippable)
 *   Done   — call onComplete() so OwnerScreen reloads with the new state
 *
 * Triggered from OwnerScreen when a freshly-signed-in owner has zero
 * stores. The owner can also reach it later via "Add Store" CTA, but
 * that path uses AdminStoresScreen — this screen is specifically the
 * "welcome, let's get you set up" experience.
 */
export function SetupScreen({ onComplete }: { onComplete: () => void }) {
  const session = useSession();
  const browserTz = useMemo(() => getBrowserTimeZone(), []);
  const allTimeZones = useMemo(() => getSupportedTimeZones(), []);

  const [step, setStep] = useState<Step>("store");
  const [createdStoreId, setCreatedStoreId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tzPickerOpen, setTzPickerOpen] = useState(false);
  const [tzQuery, setTzQuery] = useState("");

  // Step 1 form
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [closeTime, setCloseTime] = useState("23:30");
  const [timezone, setTimezone] = useState(browserTz);

  // Step 2 form
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");

  async function submitStore() {
    if (!storeName.trim()) { setError(t("admin.storeNameRequired")); return; }
    if (!TIME_REGEX.test(closeTime)) { setError(t("admin.closeTimeInvalid")); return; }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createStore({
        storeName: storeName.trim(),
        address: address.trim() || undefined,
        closeTime,
        timezone
      });
      setCreatedStoreId(created.id);
      setStep("employee");
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : err?.message || t("admin.saveStoreFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEmployee() {
    if (!createdStoreId) return;
    if (!empName.trim()) { setError(t("admin.fullName") + " — required."); return; }
    if (!empEmail.trim()) { setError(t("admin.email") + " — required."); return; }
    setSubmitting(true);
    setError(null);
    try {
      await inviteEmployee({
        name: empName.trim(),
        email: empEmail.trim(),
        storeId: createdStoreId
      });
      setStep("done");
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : err?.message || t("setup.inviteFailed"));
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Text style={s.kicker}>{t("setup.kicker")}</Text>
          <Text style={s.title}>
            {t("setup.welcome")}{session.profile?.name ? `, ${session.profile.name}` : ""}.
          </Text>
          <Text style={s.subtitle}>{t("setup.subtitle")}</Text>
        </View>

        {/* Step indicator */}
        <View style={s.stepsRow}>
          <StepDot label={t("setup.stepStore")} state={step === "store" ? "current" : "done"} />
          <View style={s.stepDivider} />
          <StepDot
            label={t("setup.stepEmployee")}
            state={step === "employee" ? "current" : step === "done" ? "done" : "todo"}
          />
          <View style={s.stepDivider} />
          <StepDot label={t("setup.stepDone")} state={step === "done" ? "current" : "todo"} />
        </View>

        <Card style={{ gap: spacing.md }}>
          {error ? <Banner tone="bad" title={t("common.error")} body={error} /> : null}

          {step === "store" ? (
            <>
              <Text style={s.stepTitle}>🏪  {t("setup.createFirstStore")}</Text>
              <Field label={t("admin.storeName")}>
                <TextInput
                  value={storeName} onChangeText={setStoreName}
                  placeholder={t("admin.storeNamePlaceholder")}
                  placeholderTextColor={colors.inkMuted}
                  style={s.input}
                  autoFocus
                />
              </Field>
              <Field label={t("admin.addressOptional")}>
                <TextInput
                  value={address} onChangeText={setAddress}
                  placeholder={t("admin.addressPlaceholder")}
                  placeholderTextColor={colors.inkMuted}
                  style={s.input}
                />
              </Field>
              <Field label={t("admin.dailyCloseTime")}>
                <TextInput
                  value={closeTime} onChangeText={setCloseTime}
                  placeholder="23:30"
                  placeholderTextColor={colors.inkMuted}
                  style={[s.input, { width: 120 }]}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
                <Text style={s.help}>{t("setup.closeTimeHelp")}</Text>
              </Field>
              <Field label={t("admin.timezone")}>
                <TouchableOpacity style={s.input} onPress={() => setTzPickerOpen(true)}>
                  <Text style={s.inputText}>
                    {timezone}{timezone === browserTz ? ` (${t("admin.detectedTimezone")})` : ""}
                  </Text>
                </TouchableOpacity>
                <Text style={s.help}>{t("setup.timezoneHelp").replace("{tz}", browserTz)}</Text>
              </Field>
              <Button
                title={submitting ? t("admin.saving") : t("admin.createStore")}
                onPress={submitStore}
                loading={submitting}
                disabled={submitting}
              />
            </>
          ) : null}

          {step === "employee" ? (
            <>
              <Text style={s.stepTitle}>👥  {t("setup.inviteFirstEmployee")}</Text>
              <Text style={s.help}>{t("setup.inviteIntro")}</Text>
              <Field label={t("admin.fullName")}>
                <TextInput
                  value={empName} onChangeText={setEmpName}
                  placeholder="e.g. Maya López"
                  placeholderTextColor={colors.inkMuted}
                  style={s.input}
                  autoFocus
                />
              </Field>
              <Field label={t("admin.email")}>
                <TextInput
                  value={empEmail} onChangeText={setEmpEmail}
                  placeholder="maya@example.com"
                  placeholderTextColor={colors.inkMuted}
                  style={s.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Field>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button title={t("setup.skipForNow")} variant="secondary" onPress={() => setStep("done")} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={submitting ? t("common.sending") : t("setup.sendInvite")}
                    onPress={submitEmployee}
                    loading={submitting}
                    disabled={submitting}
                  />
                </View>
              </View>
            </>
          ) : null}

          {step === "done" ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.lg, gap: spacing.md }}>
              <View style={s.checkCircle}>
                <Text style={s.checkIcon}>✓</Text>
              </View>
              <Text style={s.doneTitle}>{t("setup.doneTitle")}</Text>
              <Text style={s.doneBody}>{t("setup.doneBody")}</Text>
              <View style={{ width: "100%" }}>
                <Button title={t("setup.goToDashboard")} onPress={onComplete} />
              </View>
            </View>
          ) : null}
        </Card>
      </ScrollView>

      {/* Timezone picker modal — reuses the AdminStoresScreen pattern */}
      {tzPickerOpen ? (
        <View style={s.tzOverlay}>
          <View style={s.tzModal}>
            <View style={s.tzHeader}>
              <Text style={s.tzTitle}>{t("admin.chooseTimezone")}</Text>
              <TouchableOpacity onPress={() => setTzPickerOpen(false)} style={s.tzCloseBtn}>
                <Text style={s.tzClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={tzQuery}
              onChangeText={setTzQuery}
              placeholder={t("admin.searchTimezones")}
              placeholderTextColor={colors.inkMuted}
              style={s.input}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            <ScrollView style={{ maxHeight: 400, marginTop: spacing.sm }} keyboardShouldPersistTaps="handled">
              {filteredTz.map((tz) => (
                <Pressable
                  key={tz}
                  onPress={() => {
                    setTimezone(tz);
                    setTzPickerOpen(false);
                    setTzQuery("");
                  }}
                  style={({ pressed }) => [s.tzRow, pressed && { backgroundColor: colors.smoke }]}
                >
                  <Text style={[s.tzRowLabel, timezone === tz && { color: colors.leaf }]}>{tz}</Text>
                  {timezone === tz ? <Text style={s.tzCheck}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function StepDot({ label, state }: { label: string; state: "todo" | "current" | "done" }) {
  const dotBg = state === "current" ? colors.leaf : state === "done" ? colors.leafSoft : colors.smoke;
  const dotColor = state === "current" ? colors.white : state === "done" ? colors.leaf : colors.inkMuted;
  const labelColor = state === "current" ? colors.leaf : state === "done" ? colors.inkSoft : colors.inkMuted;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={[s.stepDotInner, { backgroundColor: dotBg }]}>
        <Text style={[s.stepDotText, { color: dotColor }]}>{state === "done" ? "✓" : ""}</Text>
      </View>
      <Text style={[s.stepLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40 },
  header: { alignItems: "center", marginBottom: spacing.lg },
  kicker: { color: colors.leaf, fontWeight: font.black, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 },
  title: { color: colors.ink, fontWeight: font.black, fontSize: 26, marginTop: 4, textAlign: "center", letterSpacing: -0.3 },
  subtitle: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 14, marginTop: 6, textAlign: "center", lineHeight: 20 },
  stepsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: spacing.lg },
  stepDivider: { width: 32, height: 1, backgroundColor: colors.border },
  stepDotInner: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepDotText: { fontWeight: font.black, fontSize: 13 },
  stepLabel: { fontWeight: font.black, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 },
  stepTitle: { color: colors.ink, fontWeight: font.black, fontSize: 18 },
  fieldLabel: { color: colors.ink, fontWeight: font.black, fontSize: 13, marginBottom: 6 },
  input: {
    minHeight: 50, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.inputBorder,
    fontSize: 15, color: colors.ink, backgroundColor: colors.white, fontWeight: font.bold,
    justifyContent: "center"
  },
  inputText: { fontSize: 15, color: colors.ink, fontWeight: font.bold },
  help: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 12, marginTop: 4 },
  checkCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.leafSoft, alignItems: "center", justifyContent: "center" },
  checkIcon: { color: colors.leaf, fontWeight: font.black, fontSize: 32 },
  doneTitle: { color: colors.ink, fontWeight: font.black, fontSize: 22 },
  doneBody: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 14, textAlign: "center", lineHeight: 20 },
  // Timezone picker overlay (simpler than nested Modal since we're already in KAV)
  tzOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: spacing.lg },
  tzModal: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, maxHeight: "80%" },
  tzHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  tzTitle: { flex: 1, color: colors.ink, fontWeight: font.black, fontSize: 16 },
  tzCloseBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.smoke },
  tzClose: { color: colors.ink, fontWeight: font.black, fontSize: 18 },
  tzRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  tzRowLabel: { flex: 1, color: colors.ink, fontWeight: font.bold, fontSize: 14 },
  tzCheck: { color: colors.leaf, fontWeight: font.black, fontSize: 18 }
});
