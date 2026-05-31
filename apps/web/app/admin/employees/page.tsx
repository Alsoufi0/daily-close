"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Key, Loader2, Plus, ShieldCheck, Store, Trash2, User, X } from "lucide-react";
import { useSession } from "../../../lib/use-session";
import { useShowMore } from "../../../lib/use-show-more";
import { useLanguage } from "../../../components/language-provider";
import { ListRevealControls } from "../../../components/show-more-button";
import {
  ApiError,
  assignEmployeeToStore,
  deleteEmployee,
  inviteEmployee,
  listEmployees,
  resetEmployeePassword,
  setEmployeeAdminAccess,
  setEmployeeManagerStores
} from "../../../lib/api-client";

export default function EmployeesAdminPage() {
  const session = useSession();
  const { t } = useLanguage();
  // A2P 10DLC: when contactType === "phone" the owner MUST tick this box
  // before the submit button enables. The exact label is captured on submit
  // and persisted server-side so the audit trail records what the owner saw.
  const [smsConsent, setSmsConsent] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactType, setContactType] = useState<"email" | "phone">("email");
  const [storeId, setStoreId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Phase 2: multi-store assignment UI. `assignTarget` is the user we're
  // about to add a store to (the modal opens with them pre-selected).
  const [assignTarget, setAssignTarget] = useState<{ employeeId: string; userId: string; name: string; assignedStoreIds: Set<string> } | null>(null);
  const [assigning, setAssigning] = useState(false);
  // Admin-access chooser: account-wide vs specific stores. Opens with the
  // user's current state (isAdmin + which stores they already manage).
  const [adminTarget, setAdminTarget] = useState<
    { primaryEmployeeId: string; userId: string; name: string; isAdmin: boolean; managerStoreIds: string[] } | null
  >(null);
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Group the flat list of assignment rows by user so a multi-store
  // employee appears as ONE card with a chip per store, not as
  // duplicate rows. Each group keeps the underlying assignment rows
  // so per-store actions (remove from this store, etc.) still target
  // the right id.
  type EmployeeGroup = {
    userId: string;
    name: string;
    email: string;
    isAdmin: boolean;
    // First assignment row's id — used for actions that target the user
    // (reset password, toggle admin, fully remove user) since those
    // operate on user-level state, not per-store.
    primaryEmployeeId: string;
    assignments: Array<{ id: string; storeId: string; storeName: string; role: string }>;
    // Store ids where this user is a per-store admin (MANAGER assignment).
    managerStoreIds: string[];
  };
  const grouped: EmployeeGroup[] = useMemo(() => {
    const byUser = new Map<string, EmployeeGroup>();
    for (const e of employees) {
      const userId = e.user?.id || e.userId;
      if (!userId) continue;
      let g = byUser.get(userId);
      if (!g) {
        g = {
          userId,
          name: e.user?.name ?? e.name ?? "Employee",
          email: e.user?.email ?? e.email ?? "",
          isAdmin: e.user?.role === "STORE_OWNER",
          primaryEmployeeId: e.id,
          assignments: [],
          managerStoreIds: []
        };
        byUser.set(userId, g);
      }
      const storeId = e.storeId ?? e.store?.id;
      g.assignments.push({
        id: e.id,
        storeId,
        storeName: e.store?.storeName ?? "",
        role: e.role ?? "EMPLOYEE"
      });
      if (e.role === "MANAGER" && storeId) g.managerStoreIds.push(storeId);
    }
    return Array.from(byUser.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const { visible, hasMore, remaining, canShowLess, showMore, showLess } = useShowMore(grouped, 10);

  async function remove(employeeId: string, name: string) {
    if (!session.token) return;
    if (!window.confirm(t("admin.removeConfirm").replace("{name}", name))) {
      return;
    }
    setDeletingId(employeeId);
    setError(null);
    try {
      await deleteEmployee(session.token, employeeId);
      setEmployees((prev) => prev.filter((e: any) => e.id !== employeeId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove employee");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    if (!session.token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    listEmployees(session.token)
      .then((rows) => !cancelled && setEmployees(rows))
      .catch(() => !cancelled && setEmployees([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  useEffect(() => {
    if (!storeId && session.stores[0]) setStoreId(session.stores[0].id);
  }, [session.stores, storeId]);

  async function reset(employeeId: string) {
    if (!session.token) return;
    setResettingId(employeeId);
    setError(null);
    try {
      const r = await resetEmployeePassword(session.token, employeeId);
      setResetResult({ email: r.email, tempPassword: r.tempPassword });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset password");
    } finally {
      setResettingId(null);
    }
  }

  async function applyAdminAccess(result: { kind: "account" | "stores" | "none"; storeIds?: string[] }) {
    if (!session.token || !adminTarget) return;
    setSavingAdmin(true);
    setError(null);
    try {
      if (result.kind === "account") {
        // Account-wide admin. Clear any per-store manager rows first so the two
        // models don't overlap, then promote to account admin.
        if (adminTarget.managerStoreIds.length > 0) {
          await setEmployeeManagerStores(session.token, adminTarget.userId, []);
        }
        if (!adminTarget.isAdmin) {
          await setEmployeeAdminAccess(session.token, adminTarget.primaryEmployeeId, true);
        }
        setInfo(t("admin.accountAdminSet").replace("{name}", adminTarget.name));
      } else if (result.kind === "stores") {
        // Per-store admin. If they were account admin, step them down first.
        if (adminTarget.isAdmin) {
          await setEmployeeAdminAccess(session.token, adminTarget.primaryEmployeeId, false);
        }
        await setEmployeeManagerStores(session.token, adminTarget.userId, result.storeIds ?? []);
        const count = result.storeIds?.length ?? 0;
        setInfo(
          count > 0
            ? t("admin.storeAdminSet").replace("{name}", adminTarget.name).replace("{count}", String(count))
            : t("admin.adminRemoved").replace("{name}", adminTarget.name)
        );
      } else {
        if (adminTarget.isAdmin) {
          await setEmployeeAdminAccess(session.token, adminTarget.primaryEmployeeId, false);
        }
        if (adminTarget.managerStoreIds.length > 0) {
          await setEmployeeManagerStores(session.token, adminTarget.userId, []);
        }
        setInfo(t("admin.adminRemoved").replace("{name}", adminTarget.name));
      }
      setAdminTarget(null);
      // Re-fetch so role/manager badges reconcile with the server.
      const rows = await listEmployees(session.token);
      setEmployees(rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update admin access");
    } finally {
      setSavingAdmin(false);
    }
  }

  async function confirmAssign(targetStoreId: string) {
    if (!session.token || !assignTarget) return;
    setAssigning(true);
    setError(null);
    try {
      const result = await assignEmployeeToStore(
        session.token,
        assignTarget.employeeId,
        targetStoreId
      );
      if (result.alreadyAssigned) {
        setInfo(t("admin.alreadyAssigned"));
      } else {
        // Optimistically add the new assignment to the local list so the
        // chip appears immediately. The next list refresh will reconcile.
        const newStoreName = session.stores.find((s) => s.id === targetStoreId)?.storeName ?? t("common.store");
        setEmployees((prev) => [
          ...prev,
          {
            id: result.employeeId,
            userId: assignTarget.userId,
            storeId: targetStoreId,
            user: { id: assignTarget.userId, name: assignTarget.name, email: "" },
            store: { id: targetStoreId, storeName: newStoreName }
          }
        ]);
        setInfo(t("admin.canNowClose").replace("{name}", assignTarget.name).replace("{store}", newStoreName));
      }
      setAssignTarget(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign to store");
    } finally {
      setAssigning(false);
    }
  }

  async function unassignFromStore(employeeRowId: string, name: string, storeName: string) {
    if (!session.token) return;
    if (
      !window.confirm(
        t("admin.unassignConfirm").replace("{name}", name).replace("{store}", storeName)
      )
    ) {
      return;
    }
    setDeletingId(employeeRowId);
    setError(null);
    try {
      // Same endpoint as full-user removal — at the row level it soft-deletes
      // the single assignment. If this is the user's LAST assignment row,
      // remove() additionally deletes their Supabase auth user (handled
      // server-side in EmployeesService.remove).
      await deleteEmployee(session.token, employeeRowId);
      setEmployees((prev) => prev.filter((e: any) => e.id !== employeeRowId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove from store");
    } finally {
      setDeletingId(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session.token) return;
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      const consentText = t("admin.smsConsentLabel");
      const payload =
        contactType === "email"
          ? { name, email, storeId }
          : {
              name,
              phone,
              storeId,
              // Send the EXACT localized text the owner just saw next to
              // the checkbox so the persisted consent row matches the UI.
              consent: { granted: smsConsent, text: consentText }
            };
      const result = await inviteEmployee(session.token, payload);
      const contactDisplay = result.email || result.phone || "";
      // Push a row that matches the shape the grouping expects: the assignment
      // id is `employeeId` (NOT the user id), plus a real `store` object so the
      // store chip renders immediately instead of showing blank until reload.
      const newStoreName = session.stores.find((s) => s.id === storeId)?.storeName ?? "";
      setEmployees((prev) => [
        ...prev,
        {
          id: result.employeeId,
          userId: result.id,
          storeId,
          user: { id: result.id, name, email: contactDisplay, role: "EMPLOYEE" },
          store: { id: storeId, storeName: newStoreName }
        }
      ]);

      // When the welcome SMS was sent we skip the share-this-password modal —
      // the employee already has everything they need. The owner just gets a
      // brief confirmation. When SMS was attempted but failed (or the invite
      // was email-based to begin with), fall back to the manual share modal so
      // the password is still recoverable.
      if (result.smsSent) {
        setInfo(t("admin.welcomeSmsSent").replace("{phone}", result.phone ?? ""));
      } else {
        setResetResult({ email: contactDisplay, tempPassword: result.tempPassword });
        if (contactType === "phone" && result.smsError) {
          setInfo(`SMS could not be sent (${result.smsError}). Share the password below manually.`);
        }
      }

      setName("");
      setEmail("");
      setPhone("");
      setSmsConsent(false);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not invite employee");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-black">{t("admin.employees")}</h1>
          <p className="text-sm font-bold text-ink/65">{t("admin.inviteEmployees")}</p>
        </div>
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-4 font-black text-white sm:w-auto"
          >
            <Plus size={16} /> {t("admin.invite")}
          </button>
        ) : null}
      </div>

      {info ? (
        <div className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm font-bold text-leaf">
          {info}
        </div>
      ) : null}

      {showForm ? (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-ink/10 bg-white p-5 shadow-sm">
          {error ? (
            <div className="rounded-lg border border-warning/30 bg-red-50 p-3 text-sm font-bold text-warning">
              {error}
            </div>
          ) : null}
          <Field label={t("admin.fullName")}>
            <input
              required
              autoFocus
              className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 text-base font-bold"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div>
            <div className="mb-2 grid grid-cols-2 rounded-lg bg-smoke p-0.5 text-sm font-black">
              <button
                type="button"
                onClick={() => setContactType("email")}
                className={contactType === "email" ? "rounded-md bg-white px-3 py-1.5 shadow-sm" : "px-3 py-1.5 text-ink/55"}
              >
                {t("admin.email")}
              </button>
              <button
                type="button"
                onClick={() => setContactType("phone")}
                className={contactType === "phone" ? "rounded-md bg-white px-3 py-1.5 shadow-sm" : "px-3 py-1.5 text-ink/55"}
              >
                {t("admin.phone")}
              </button>
            </div>
            {contactType === "email" ? (
              <Field label={t("admin.email")}>
                <input
                  required
                  type="email"
                  className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 text-base font-bold"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
            ) : (
              <Field label={t("admin.phoneLabel")}>
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  placeholder="+15551234567"
                  className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 text-base font-bold"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
            )}
          </div>
          <Field label={t("common.store")}>
            <select
              required
              className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-3 text-base font-bold"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
            >
              {session.stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.storeName}
                </option>
              ))}
            </select>
          </Field>
          {contactType === "phone" ? (
            <label className="flex items-start gap-2 rounded-lg border border-ink/15 bg-smoke/40 p-3 text-sm font-bold text-ink/80">
              <input
                type="checkbox"
                required
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-leaf"
                aria-describedby="sms-consent-help"
              />
              <span id="sms-consent-help">{t("admin.smsConsentLabel")}</span>
            </label>
          ) : null}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="focus-ring h-12 flex-1 rounded-lg border-2 border-ink/15 bg-white font-black text-ink hover:bg-smoke"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting || (contactType === "phone" && !smsConsent)}
              className="focus-ring flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-leaf font-black text-white disabled:opacity-60"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
              {submitting ? t("admin.sending") : t("admin.sendInvite")}
            </button>
          </div>
        </form>
      ) : null}

      {error && !showForm ? (
        <div className="rounded-xl border border-warning/30 bg-red-50 p-3 text-sm font-bold text-warning">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-ink/10 bg-white p-6 text-center text-sm font-bold text-ink/55">
            <Loader2 className="mx-auto mb-2 animate-spin" size={18} />
            {t("admin.loadingEmployees")}
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-xl border border-ink/10 bg-white p-8 text-center text-sm font-bold text-ink/65">
            {t("admin.noEmployees")}
          </div>
        ) : (
          visible.map((g) => (
            <div
              key={g.userId}
              className="space-y-3 rounded-xl border border-ink/10 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                  <User size={18} aria-hidden />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-black truncate">{g.name}</p>
                  <p className="text-xs font-bold text-ink/55 truncate">{g.email}</p>
                </div>
                {g.isAdmin ? <span className="rounded-full bg-leaf/10 px-2 py-0.5 text-xs font-black text-leaf">{t("admin.adminBadge")}</span> : null}
              </div>

              {/* Store chips — one per assignment row, with per-chip unassign */}
              <div className="flex flex-wrap items-center gap-2">
                {g.assignments.map((a) => (
                  <span
                    key={a.id}
                    className={
                      a.role === "MANAGER"
                        ? "inline-flex items-center gap-1.5 rounded-full bg-leaf/10 px-2.5 py-1 text-xs font-black text-leaf"
                        : "inline-flex items-center gap-1.5 rounded-full bg-smoke px-2.5 py-1 text-xs font-black text-ink"
                    }
                    title={a.role === "MANAGER" ? t("admin.adminBadge") : undefined}
                  >
                    {a.role === "MANAGER" ? <ShieldCheck size={12} aria-hidden /> : <Store size={12} aria-hidden />}
                    {a.storeName}
                    <button
                      onClick={() => unassignFromStore(a.id, g.name, a.storeName)}
                      disabled={deletingId === a.id}
                      aria-label={`Remove ${g.name} from ${a.storeName}`}
                      className="focus-ring rounded-full p-0.5 text-ink/50 hover:bg-warning/10 hover:text-warning disabled:opacity-60"
                    >
                      {deletingId === a.id ? <Loader2 className="animate-spin" size={11} /> : <X size={11} />}
                    </button>
                  </span>
                ))}
                <button
                  onClick={() =>
                    setAssignTarget({
                      employeeId: g.primaryEmployeeId,
                      userId: g.userId,
                      name: g.name,
                      assignedStoreIds: new Set(g.assignments.map((a) => a.storeId))
                    })
                  }
                  className="focus-ring inline-flex items-center gap-1 rounded-full border border-dashed border-ink/25 px-2.5 py-1 text-xs font-black text-ink/65 hover:border-leaf hover:text-leaf"
                >
                  <Plus size={11} /> {t("admin.assignAnotherStore")}
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() =>
                    setAdminTarget({
                      primaryEmployeeId: g.primaryEmployeeId,
                      userId: g.userId,
                      name: g.name,
                      isAdmin: g.isAdmin,
                      managerStoreIds: g.managerStoreIds
                    })
                  }
                  className={
                    g.isAdmin || g.managerStoreIds.length > 0
                      ? "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-leaf px-3 text-xs font-black text-white disabled:opacity-60"
                      : "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/15 px-3 text-xs font-black text-ink hover:bg-smoke disabled:opacity-60"
                  }
                  aria-label="Manage admin access"
                >
                  <ShieldCheck size={14} />
                  {g.isAdmin
                    ? t("admin.accountAdmin")
                    : g.managerStoreIds.length > 0
                      ? t("admin.storeAdminCount").replace("{count}", String(g.managerStoreIds.length))
                      : t("admin.makeAdmin")}
                </button>
                <button
                  onClick={() => reset(g.primaryEmployeeId)}
                  disabled={resettingId === g.primaryEmployeeId}
                  className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/15 px-3 text-xs font-black text-ink hover:bg-smoke disabled:opacity-60"
                  aria-label={t("admin.passwordReset")}
                >
                  {resettingId === g.primaryEmployeeId ? <Loader2 className="animate-spin" size={14} /> : <Key size={14} />}
                  {t("admin.passwordReset")}
                </button>
                {/* Removing the LAST chip via the chip's X already removes
                    the entire user via the existing remove flow. Skip a
                    redundant "remove user" action here. */}
              </div>
            </div>
          ))
        )}
        <ListRevealControls
          hasMore={hasMore}
          canShowLess={canShowLess}
          remaining={remaining}
          onShowMore={showMore}
          onShowLess={showLess}
          showMoreLabel={t("common.showMore")}
          showLessLabel={t("common.showLess")}
        />
      </div>

      {resetResult ? (
        <ResetPasswordModal
          email={resetResult.email}
          tempPassword={resetResult.tempPassword}
          onClose={() => setResetResult(null)}
        />
      ) : null}

      {assignTarget ? (
        <AssignToStoreModal
          target={assignTarget}
          stores={session.stores}
          submitting={assigning}
          onCancel={() => setAssignTarget(null)}
          onConfirm={confirmAssign}
        />
      ) : null}

      {adminTarget ? (
        <AdminAccessModal
          target={adminTarget}
          stores={session.stores}
          submitting={savingAdmin}
          onCancel={() => setAdminTarget(null)}
          onApply={applyAdminAccess}
        />
      ) : null}
    </div>
  );
}

function AdminAccessModal({
  target,
  stores,
  submitting,
  onCancel,
  onApply
}: {
  target: { name: string; isAdmin: boolean; managerStoreIds: string[] };
  stores: Array<{ id: string; storeName: string }>;
  submitting: boolean;
  onCancel: () => void;
  onApply: (result: { kind: "account" | "stores" | "none"; storeIds?: string[] }) => void;
}) {
  // Three mutually-exclusive levels: no admin, admin of specific stores, or
  // admin of the whole account. Pre-select the user's current state.
  const { t } = useLanguage();
  type Mode = "none" | "stores" | "account";
  const [mode, setMode] = useState<Mode>(
    target.isAdmin ? "account" : target.managerStoreIds.length > 0 ? "stores" : "none"
  );
  const [picked, setPicked] = useState<Set<string>>(new Set(target.managerStoreIds));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function toggleStore(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    if (mode === "account") onApply({ kind: "account" });
    else if (mode === "stores") onApply({ kind: "stores", storeIds: Array.from(picked) });
    else onApply({ kind: "none" });
  }

  const Choice = ({ value, title, desc }: { value: Mode; title: string; desc: string }) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={
        mode === value
          ? "focus-ring w-full rounded-xl border-2 border-leaf bg-leaf/5 p-3 text-left"
          : "focus-ring w-full rounded-xl border-2 border-ink/10 bg-white p-3 text-left hover:bg-smoke"
      }
    >
      <p className="text-sm font-black text-ink">{title}</p>
      <p className="text-xs font-bold text-ink/55">{desc}</p>
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-access-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onCancel}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id="admin-access-title" className="text-lg font-black text-ink">
            {t("admin.adminAccessFor").replace("{name}", target.name)}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="focus-ring rounded-lg p-1 text-ink/40 hover:bg-smoke hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <Choice value="none" title={t("admin.noAdminAccess")} desc={t("admin.noAdminAccessDesc")} />
          <Choice value="stores" title={t("admin.storeAdminOption")} desc={t("admin.storeAdminOptionDesc")} />
          <Choice value="account" title={t("admin.fullAdminOption")} desc={t("admin.fullAdminOptionDesc")} />
        </div>

        {mode === "stores" ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-ink/55">{t("admin.chooseStores")}</p>
            <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-ink/10 p-2">
              {stores.length === 0 ? (
                <p className="p-2 text-sm font-bold text-ink/55">{t("admin.noStoresYet")}</p>
              ) : (
                stores.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-smoke"
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(s.id)}
                      onChange={() => toggleStore(s.id)}
                      className="h-4 w-4 accent-leaf"
                    />
                    <span className="text-sm font-bold text-ink">{s.storeName}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring h-10 rounded-lg border border-ink/15 bg-white px-4 text-sm font-black text-ink hover:bg-smoke"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={submitting || (mode === "stores" && picked.size === 0)}
            className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-lg bg-leaf px-4 text-sm font-black text-white disabled:opacity-60"
          >
            {submitting ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignToStoreModal({
  target,
  stores,
  submitting,
  onCancel,
  onConfirm
}: {
  target: { name: string; assignedStoreIds: Set<string> };
  stores: Array<{ id: string; storeName: string }>;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (storeId: string) => void;
}) {
  const { t } = useLanguage();
  // Filter out stores the user is already assigned to so the dropdown
  // only offers actionable choices.
  const available = stores.filter((s) => !target.assignedStoreIds.has(s.id));
  const [storeId, setStoreId] = useState(available[0]?.id ?? "");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-store-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id="assign-store-title" className="text-lg font-black text-ink">
            {t("admin.assignTitle").replace("{name}", target.name)}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="focus-ring rounded-lg p-1 text-ink/40 hover:bg-smoke hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {available.length === 0 ? (
          <p className="mt-4 text-sm font-bold text-ink/65">
            {t("admin.assignAllDone").replace("{name}", target.name)}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm font-bold text-ink/65">
              {t("admin.assignDesc")}
            </p>
            <label className="mt-4 block">
              <span className="text-sm font-black">{t("common.store")}</span>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="focus-ring mt-2 h-12 w-full rounded-lg border border-ink/15 px-3 font-bold"
              >
                {available.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.storeName}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring h-10 rounded-lg border border-ink/15 bg-white px-4 text-sm font-black text-ink hover:bg-smoke"
          >
            {t("common.cancel")}
          </button>
          {available.length > 0 ? (
            <button
              type="button"
              onClick={() => onConfirm(storeId)}
              disabled={submitting || !storeId}
              className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-lg bg-leaf px-4 text-sm font-black text-white disabled:opacity-60"
            >
              {submitting ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
              {t("admin.assign")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({
  email,
  tempPassword,
  onClose
}: {
  email: string;
  tempPassword: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-leaf">{t("admin.passwordReset")}</p>
            <h2 className="text-xl font-black">{t("admin.shareWith").replace("{email}", email)}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="focus-ring rounded-lg p-2 text-ink/55 hover:bg-smoke"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-sm font-bold text-ink/65">
          {t("admin.tempPasswordNote")}
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-ink/15 bg-smoke px-3 py-3 font-mono text-lg font-black">
          <span className="flex-1 break-all">{tempPassword}</span>
          <button
            onClick={copy}
            className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-md bg-white px-3 text-xs font-black hover:bg-smoke"
          >
            <Copy size={14} /> {copied ? t("admin.copied") : t("admin.copy")}
          </button>
        </div>
        <p className="mt-4 text-xs font-bold text-ink/55">
          {t("admin.sharePasswordNote")}
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-black">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
