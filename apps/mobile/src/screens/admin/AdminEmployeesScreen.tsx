import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  ApiError,
  assignEmployeeToStore,
  deleteEmployee,
  EmployeeRow,
  inviteEmployee,
  listEmployees,
  listStores,
  resetEmployeePassword,
  setEmployeeAdminAccess,
  setEmployeeManagerStores,
  StoreRecord
} from "../../api";
import { Button, Card } from "../../ui";
import { SkeletonRow } from "../../ui/Skeleton";
import { colors, font, radius, spacing } from "../../theme";
import { t } from "../../i18n";

// Grouped view — one card per user, listing all their store assignments
// so multi-store employees show as a single card with chips, not as
// duplicate rows. Mirrors the web admin/employees grouping logic.
interface EmployeeGroup {
  userId: string;
  name: string;
  contact: string; // email OR phone display
  isAccountAdmin: boolean;
  primaryEmployeeId: string; // first assignment row id — used for user-level ops
  assignments: Array<{ id: string; storeId: string; storeName: string; role: string }>;
  managerStoreIds: string[];
}

function groupByUser(rows: EmployeeRow[]): EmployeeGroup[] {
  const byUser = new Map<string, EmployeeGroup>();
  for (const e of rows) {
    const userId = e.user?.id;
    if (!userId) continue;
    let g = byUser.get(userId);
    if (!g) {
      g = {
        userId,
        name: e.user?.name ?? "Employee",
        contact: e.user?.email ?? e.user?.phone ?? "",
        isAccountAdmin: e.user?.role === "STORE_OWNER",
        primaryEmployeeId: e.id,
        assignments: [],
        managerStoreIds: []
      };
      byUser.set(userId, g);
    }
    const storeId = e.storeId;
    g.assignments.push({
      id: e.id,
      storeId,
      storeName: e.store?.storeName ?? "",
      role: e.role ?? "EMPLOYEE"
    });
    if (e.role === "MANAGER" && storeId) g.managerStoreIds.push(storeId);
  }
  return Array.from(byUser.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function AdminEmployeesScreen() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [assignTarget, setAssignTarget] = useState<EmployeeGroup | null>(null);
  const [adminTarget, setAdminTarget] = useState<EmployeeGroup | null>(null);

  const grouped = useMemo(() => groupByUser(employees), [employees]);

  const load = useCallback(async (initial: boolean) => {
    if (initial) setLoading(true);
    try {
      const [e, s] = await Promise.all([listEmployees(), listStores()]);
      setEmployees(e);
      setStores(s);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Could not load employees.");
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

  async function handleReset(group: EmployeeGroup) {
    try {
      const r = await resetEmployeePassword(group.primaryEmployeeId);
      setResetResult({ email: r.email, tempPassword: r.tempPassword });
    } catch (err: any) {
      Alert.alert("Reset failed", err?.message || "Try again.");
    }
  }

  function confirmRemove(group: EmployeeGroup, assignment?: { id: string; storeName: string }) {
    const title = assignment
      ? `Remove ${group.name} from ${assignment.storeName}?`
      : `Remove ${group.name} entirely?`;
    const body = assignment
      ? "They'll lose access to this store. Removing their LAST store assignment also deletes their sign-in."
      : "This deletes their sign-in and removes all store assignments. Past closes stay intact.";
    Alert.alert(title, body, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEmployee(assignment?.id ?? group.primaryEmployeeId);
            await load(false);
          } catch (err: any) {
            Alert.alert("Couldn't remove", err?.message || "Try again.");
          }
        }
      }
    ]);
  }

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t("admin.employees")}</Text>
          <Text style={s.headerSubtitle}>{t("admin.employeesSubtitle")}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowInvite(true)} style={s.newBtn}>
          <Text style={s.newBtnText}>+ {t("admin.invite")}</Text>
        </TouchableOpacity>
      </View>

      {info ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={s.infoBox}>
            <Text style={s.infoText}>{info}</Text>
          </View>
        </View>
      ) : null}

      {error ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        </View>
      ) : null}

      {loading && grouped.length === 0 ? (
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          {[0, 1, 2].map((i) => <SkeletonRow key={i} />)}
        </View>
      ) : !loading && grouped.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <Text style={s.emptyTitle}>{t("admin.noEmployees")}</Text>
            <Text style={s.emptyBody}>{t("admin.tapInvite")}</Text>
          </Card>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(g) => g.userId}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.leaf} />}
          renderItem={({ item }) => (
            <EmployeeCard
              group={item}
              onReset={() => handleReset(item)}
              onRemove={(assignment) => confirmRemove(item, assignment)}
              onAssign={() => setAssignTarget(item)}
              onAdmin={() => setAdminTarget(item)}
            />
          )}
        />
      )}

      <InviteModal
        visible={showInvite}
        stores={stores}
        onClose={() => setShowInvite(false)}
        onInvited={async (result) => {
          setShowInvite(false);
          if (result.smsSent) {
            setInfo(`Welcome SMS sent to ${result.phone ?? "the employee"}.`);
          } else {
            setResetResult({ email: result.email ?? result.phone ?? "", tempPassword: result.tempPassword });
            if (result.smsError) {
              setInfo(`SMS could not be sent (${result.smsError}). Share the password below manually.`);
            }
          }
          await load(false);
        }}
      />

      <ResetResultModal
        result={resetResult}
        onClose={() => setResetResult(null)}
      />

      <AssignStoreModal
        target={assignTarget}
        stores={stores}
        onClose={() => setAssignTarget(null)}
        onAssigned={async (storeName) => {
          setInfo(`${assignTarget?.name} can now close ${storeName}.`);
          setAssignTarget(null);
          await load(false);
        }}
      />

      <AdminAccessModal
        target={adminTarget}
        stores={stores}
        onClose={() => setAdminTarget(null)}
        onSaved={async (msg) => {
          setInfo(msg);
          setAdminTarget(null);
          await load(false);
        }}
      />
    </View>
  );
}

function EmployeeCard({
  group,
  onReset,
  onRemove,
  onAssign,
  onAdmin
}: {
  group: EmployeeGroup;
  onReset: () => void;
  onRemove: (assignment?: { id: string; storeName: string }) => void;
  onAssign: () => void;
  onAdmin: () => void;
}) {
  return (
    <View style={card.wrap}>
      <View style={card.headerRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={card.name} numberOfLines={1}>{group.name}</Text>
          {group.contact ? <Text style={card.contact} numberOfLines={1}>{group.contact}</Text> : null}
        </View>
        {group.isAccountAdmin ? (
          <View style={[card.roleBadge, { backgroundColor: colors.leafSoft, borderColor: colors.leafBorder }]}>
            <Text style={[card.roleBadgeText, { color: colors.leaf }]}>ADMIN</Text>
          </View>
        ) : group.managerStoreIds.length > 0 ? (
          <View style={[card.roleBadge, { backgroundColor: colors.goldSoft, borderColor: colors.goldBorder }]}>
            <Text style={[card.roleBadgeText, { color: colors.gold }]}>MANAGER</Text>
          </View>
        ) : null}
      </View>

      <View style={card.chipsRow}>
        {group.assignments.map((a) => {
          const isManager = a.role === "MANAGER";
          return (
            <Pressable
              key={a.id}
              onLongPress={() => onRemove({ id: a.id, storeName: a.storeName })}
              style={[
                card.chip,
                isManager && { backgroundColor: colors.goldSoft, borderColor: colors.goldBorder }
              ]}
            >
              <Text style={[card.chipLabel, isManager && { color: colors.gold }]} numberOfLines={1}>
                {a.storeName || "—"}
                {isManager ? " ★" : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={card.chipHint}>Long-press a store chip to remove from that store</Text>

      <View style={card.actionsRow}>
        <TouchableOpacity onPress={onAssign} style={card.actionBtn}>
          <Text style={card.actionLabel}>+ {t("admin.addStoreShort")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onAdmin} style={card.actionBtn}>
          <Text style={card.actionLabel}>{t("admin.adminAccess")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onReset} style={card.actionBtn}>
          <Text style={card.actionLabel}>{t("admin.resetPwShort")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onRemove()} style={[card.actionBtn, card.actionBtnDanger]}>
          <Text style={[card.actionLabel, { color: colors.warning }]}>{t("common.remove")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InviteModal({
  visible,
  stores,
  onClose,
  onInvited
}: {
  visible: boolean;
  stores: StoreRecord[];
  onClose: () => void;
  onInvited: (result: {
    smsSent: boolean;
    smsError: string | null;
    email: string | null;
    phone: string | null;
    tempPassword: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [contactType, setContactType] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [storeId, setStoreId] = useState<string>("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(""); setEmail(""); setPhone("");
    setStoreId(stores[0]?.id ?? "");
    setContactType("email"); setSmsConsent(false); setFormError(null);
  }, [visible, stores]);

  async function submit() {
    if (!name.trim()) { setFormError("Name is required."); return; }
    if (!storeId) { setFormError("Pick a store."); return; }
    if (contactType === "email" && !email.trim()) { setFormError("Email is required."); return; }
    if (contactType === "phone") {
      if (!phone.trim()) { setFormError("Phone is required."); return; }
      if (!smsConsent) { setFormError("Confirm employee SMS consent to continue."); return; }
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const consentText = t("admin.smsConsentLabel");
      const payload = contactType === "email"
        ? { name: name.trim(), email: email.trim(), storeId }
        : { name: name.trim(), phone: phone.trim(), storeId, consent: { granted: true, text: consentText } };
      const result = await inviteEmployee(payload);
      onInvited(result);
    } catch (err: any) {
      setFormError(err instanceof ApiError ? err.message : err?.message || "Invite failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.wrap}>
        <ModalHeader title="Invite employee" onClose={onClose} />
        <ScrollView contentContainerStyle={modal.content} keyboardShouldPersistTaps="handled">
          {formError ? (
            <View style={s.errorBox}><Text style={s.errorText}>{formError}</Text></View>
          ) : null}

          <Field label="Full name">
            <TextInput
              value={name} onChangeText={setName}
              placeholder="e.g. Maya López"
              placeholderTextColor={colors.inkMuted}
              style={modal.input}
              autoFocus
            />
          </Field>

          {/* email / phone toggle */}
          <View style={[modal.segmented]}>
            <SegmentBtn label="Email" active={contactType === "email"} onPress={() => setContactType("email")} />
            <SegmentBtn label="Phone" active={contactType === "phone"} onPress={() => setContactType("phone")} />
          </View>

          {contactType === "email" ? (
            <Field label="Email">
              <TextInput
                value={email} onChangeText={setEmail}
                placeholder="maya@example.com"
                placeholderTextColor={colors.inkMuted}
                style={modal.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
          ) : (
            <>
              <Field label="Phone (E.164, e.g. +15551234567)">
                <TextInput
                  value={phone} onChangeText={setPhone}
                  placeholder="+15551234567"
                  placeholderTextColor={colors.inkMuted}
                  style={modal.input}
                  keyboardType="phone-pad"
                />
              </Field>
              <Pressable onPress={() => setSmsConsent(!smsConsent)} style={modal.consentRow}>
                <View style={[modal.checkbox, smsConsent && modal.checkboxChecked]}>
                  {smsConsent ? <Text style={modal.checkmark}>✓</Text> : null}
                </View>
                <Text style={modal.consentText}>
                  I confirm this employee has agreed to receive SMS from Daily Close on this number. Standard message and data rates may apply.
                </Text>
              </Pressable>
            </>
          )}

          <Field label="Store">
            {stores.length === 0 ? (
              <Text style={modal.help}>No stores yet — add a store first.</Text>
            ) : (
              <View style={{ gap: spacing.xs }}>
                {stores.map((st) => (
                  <Pressable
                    key={st.id}
                    onPress={() => setStoreId(st.id)}
                    style={[modal.storeRow, storeId === st.id && modal.storeRowActive]}
                  >
                    <Text style={[modal.storeLabel, storeId === st.id && { color: colors.leaf }]}>
                      {st.storeName}
                    </Text>
                    {storeId === st.id ? <Text style={modal.storeCheck}>✓</Text> : null}
                  </Pressable>
                ))}
              </View>
            )}
          </Field>
        </ScrollView>

        <View style={modal.footer}>
          <View style={{ flex: 1 }}><Button title="Cancel" variant="secondary" onPress={onClose} /></View>
          <View style={{ flex: 1 }}>
            <Button title={submitting ? "Inviting…" : "Send invite"} onPress={submit} loading={submitting} disabled={submitting || stores.length === 0} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ResetResultModal({
  result,
  onClose
}: {
  result: { email: string; tempPassword: string } | null;
  onClose: () => void;
}) {
  async function copyPassword() {
    if (!result) return;
    await Clipboard.setStringAsync(result.tempPassword);
    Alert.alert("Copied", "Temporary password copied to clipboard.");
  }
  async function share() {
    if (!result) return;
    await Share.share({
      message: `Daily Close login — sign in at https://dailyclose.us\nEmail: ${result.email}\nTemporary password: ${result.tempPassword}\n\nChange your password right after signing in.`
    });
  }
  return (
    <Modal visible={!!result} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.wrap}>
        <ModalHeader title="Temporary password" onClose={onClose} />
        <ScrollView contentContainerStyle={modal.content}>
          <Text style={modal.label}>Share these credentials with the employee. They'll be asked to change the password after first sign-in.</Text>
          <View style={reset.credBox}>
            <Text style={reset.credLabel}>Sign-in</Text>
            <Text style={reset.credValue} selectable>{result?.email}</Text>
          </View>
          <View style={reset.credBox}>
            <Text style={reset.credLabel}>Temporary password</Text>
            <Text style={reset.credValueMono} selectable>{result?.tempPassword}</Text>
          </View>
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            <Button title="Copy password" onPress={copyPassword} />
            <Button title="Share via…" variant="secondary" onPress={share} />
          </View>
        </ScrollView>
        <View style={modal.footer}>
          <View style={{ flex: 1 }}><Button title="Done" onPress={onClose} /></View>
        </View>
      </View>
    </Modal>
  );
}

function AssignStoreModal({
  target,
  stores,
  onClose,
  onAssigned
}: {
  target: EmployeeGroup | null;
  stores: StoreRecord[];
  onClose: () => void;
  onAssigned: (storeName: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!target) return null;
  const assignedIds = new Set(target.assignments.map((a) => a.storeId));
  const available = stores.filter((s) => !assignedIds.has(s.id));

  async function assign(storeId: string, storeName: string) {
    setBusy(true);
    try {
      await assignEmployeeToStore(target!.primaryEmployeeId, storeId);
      onAssigned(storeName);
    } catch (err: any) {
      Alert.alert("Couldn't assign", err?.message || "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={!!target} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.wrap}>
        <ModalHeader title={`Add store for ${target.name}`} onClose={onClose} />
        <View style={modal.content}>
          {available.length === 0 ? (
            <Text style={modal.help}>{target.name} is already assigned to every store you own.</Text>
          ) : (
            <View style={{ gap: spacing.xs }}>
              {available.map((st) => (
                <Pressable
                  key={st.id}
                  onPress={() => assign(st.id, st.storeName)}
                  disabled={busy}
                  style={[modal.storeRow, busy && { opacity: 0.5 }]}
                >
                  <Text style={modal.storeLabel}>{st.storeName}</Text>
                  <Text style={modal.storeCheck}>+</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function AdminAccessModal({
  target,
  stores,
  onClose,
  onSaved
}: {
  target: EmployeeGroup | null;
  stores: StoreRecord[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [mode, setMode] = useState<"none" | "account" | "stores">("none");
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    if (target.isAccountAdmin) setMode("account");
    else if (target.managerStoreIds.length > 0) {
      setMode("stores");
      setSelectedStoreIds(new Set(target.managerStoreIds));
    } else {
      setMode("none");
      setSelectedStoreIds(new Set());
    }
  }, [target]);

  if (!target) return null;

  function toggleStore(id: string) {
    setSelectedStoreIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      if (mode === "account") {
        if (target!.managerStoreIds.length > 0) await setEmployeeManagerStores(target!.userId, []);
        if (!target!.isAccountAdmin) await setEmployeeAdminAccess(target!.primaryEmployeeId, true);
        onSaved(`${target!.name} is now an account admin.`);
      } else if (mode === "stores") {
        if (target!.isAccountAdmin) await setEmployeeAdminAccess(target!.primaryEmployeeId, false);
        const ids = Array.from(selectedStoreIds);
        await setEmployeeManagerStores(target!.userId, ids);
        onSaved(ids.length > 0
          ? `${target!.name} is now admin for ${ids.length} store${ids.length === 1 ? "" : "s"}.`
          : `Admin removed from ${target!.name}.`);
      } else {
        if (target!.isAccountAdmin) await setEmployeeAdminAccess(target!.primaryEmployeeId, false);
        if (target!.managerStoreIds.length > 0) await setEmployeeManagerStores(target!.userId, []);
        onSaved(`Admin removed from ${target!.name}.`);
      }
    } catch (err: any) {
      Alert.alert("Couldn't update", err?.message || "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={!!target} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.wrap}>
        <ModalHeader title={`Admin access — ${target.name}`} onClose={onClose} />
        <ScrollView contentContainerStyle={modal.content}>
          <ChoiceRow
            label="No admin access"
            description="Plain employee — can close stores they're assigned to."
            active={mode === "none"}
            onPress={() => setMode("none")}
          />
          <ChoiceRow
            label="Per-store admin (manager)"
            description="Admin powers limited to specific stores."
            active={mode === "stores"}
            onPress={() => setMode("stores")}
          />
          <ChoiceRow
            label="Account-wide admin"
            description="Full admin access to every store."
            active={mode === "account"}
            onPress={() => setMode("account")}
          />

          {mode === "stores" ? (
            <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
              <Text style={modal.label}>Manages these stores</Text>
              {stores.map((st) => {
                const checked = selectedStoreIds.has(st.id);
                return (
                  <Pressable
                    key={st.id}
                    onPress={() => toggleStore(st.id)}
                    style={[modal.storeRow, checked && modal.storeRowActive]}
                  >
                    <View style={[modal.checkbox, checked && modal.checkboxChecked]}>
                      {checked ? <Text style={modal.checkmark}>✓</Text> : null}
                    </View>
                    <Text style={[modal.storeLabel, { flex: 1 }, checked && { color: colors.leaf }]}>
                      {st.storeName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
        <View style={modal.footer}>
          <View style={{ flex: 1 }}><Button title="Cancel" variant="secondary" onPress={onClose} /></View>
          <View style={{ flex: 1 }}><Button title={saving ? "Saving…" : "Save"} onPress={save} loading={saving} disabled={saving} /></View>
        </View>
      </View>
    </Modal>
  );
}

function ChoiceRow({
  label,
  description,
  active,
  onPress
}: {
  label: string;
  description: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[choice.row, active && choice.rowActive]}>
      <View style={[choice.radio, active && choice.radioActive]}>
        {active ? <View style={choice.radioDot} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[choice.label, active && { color: colors.leaf }]}>{label}</Text>
        <Text style={choice.description}>{description}</Text>
      </View>
    </Pressable>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={modal.header}>
      <Text style={modal.title} numberOfLines={1}>{title}</Text>
      <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
        <Text style={modal.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function SegmentBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[seg.btn, active && seg.btnActive]}>
      <Text style={[seg.label, active && { color: colors.ink }]}>{label}</Text>
    </TouchableOpacity>
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
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { color: colors.ink, fontWeight: font.black, fontSize: 22, letterSpacing: -0.3 },
  headerSubtitle: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12, marginTop: 2 },
  newBtn: { backgroundColor: colors.leaf, paddingHorizontal: 14, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  newBtnText: { color: colors.white, fontWeight: font.black, fontSize: 14 },
  infoBox: { backgroundColor: colors.leafSoft, borderColor: colors.leafBorder, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  infoText: { color: colors.leaf, fontWeight: font.bold, fontSize: 13 },
  errorBox: { backgroundColor: colors.warningSoft, borderColor: colors.warningBorder, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  errorText: { color: colors.warning, fontWeight: font.bold, fontSize: 13 },
  emptyTitle: { color: colors.ink, fontWeight: font.black, fontSize: 16 },
  emptyBody: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 13, marginTop: 4, textAlign: "center" }
});

const card = StyleSheet.create({
  wrap: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { color: colors.ink, fontWeight: font.black, fontSize: 16 },
  contact: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12, marginTop: 2 },
  roleBadge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  roleBadgeText: { fontWeight: font.black, fontSize: 10, letterSpacing: 0.5 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { backgroundColor: colors.smoke, borderWidth: 1, borderColor: colors.border, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, maxWidth: 200 },
  chipLabel: { color: colors.ink, fontWeight: font.black, fontSize: 12 },
  chipHint: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 11 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  actionBtn: { flexGrow: 1, paddingVertical: 8, paddingHorizontal: spacing.sm, backgroundColor: colors.smoke, borderRadius: radius.sm, alignItems: "center", minWidth: 80 },
  actionBtnDanger: { backgroundColor: colors.warningSoft },
  actionLabel: { color: colors.ink, fontWeight: font.black, fontSize: 12 }
});

const modal = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  title: { color: colors.ink, fontWeight: font.black, fontSize: 18, flex: 1 },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.smoke },
  closeText: { color: colors.ink, fontWeight: font.black, fontSize: 18 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  label: { color: colors.ink, fontWeight: font.black, fontSize: 13, marginBottom: 6 },
  help: { color: colors.inkMuted, fontWeight: font.bold, fontSize: 12, marginTop: 4 },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.white, fontWeight: font.bold },
  footer: { flexDirection: "row", gap: spacing.md, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white },
  segmented: { flexDirection: "row", backgroundColor: colors.smoke, borderRadius: radius.md, padding: 3, marginBottom: spacing.lg },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.smoke, borderRadius: radius.md, marginBottom: spacing.lg },
  consentText: { flex: 1, color: colors.ink, fontWeight: font.bold, fontSize: 12, lineHeight: 18 },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: colors.inputBorder, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  checkboxChecked: { backgroundColor: colors.leaf, borderColor: colors.leaf },
  checkmark: { color: colors.white, fontWeight: font.black, fontSize: 14 },
  storeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  storeRowActive: { borderColor: colors.leaf, backgroundColor: colors.leafSoft },
  storeLabel: { color: colors.ink, fontWeight: font.black, fontSize: 14 },
  storeCheck: { color: colors.leaf, fontWeight: font.black, fontSize: 18 }
});

const seg = StyleSheet.create({
  btn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: radius.sm },
  btnActive: { backgroundColor: colors.white },
  label: { color: colors.inkMuted, fontWeight: font.black, fontSize: 13 }
});

const choice = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, padding: spacing.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.sm },
  rowActive: { borderColor: colors.leaf, backgroundColor: colors.leafSoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.inputBorder, marginTop: 2, alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: colors.leaf },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.leaf },
  label: { color: colors.ink, fontWeight: font.black, fontSize: 14 },
  description: { color: colors.inkSoft, fontWeight: font.bold, fontSize: 12, marginTop: 2 }
});

const reset = StyleSheet.create({
  credBox: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  credLabel: { color: colors.inkMuted, fontWeight: font.black, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  credValue: { color: colors.ink, fontWeight: font.bold, fontSize: 15, marginTop: 4 },
  credValueMono: { color: colors.ink, fontWeight: font.black, fontSize: 18, marginTop: 4, fontFamily: "monospace", letterSpacing: 1 }
});
