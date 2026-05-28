"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Key, Loader2, Plus, ShieldCheck, Store, Trash2, User, X } from "lucide-react";
import { useSession } from "../../../lib/use-session";
import {
  ApiError,
  assignEmployeeToStore,
  deleteEmployee,
  inviteEmployee,
  listEmployees,
  resetEmployeePassword,
  setEmployeeAdminAccess
} from "../../../lib/api-client";

export default function EmployeesAdminPage() {
  const session = useSession();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [storeId, setStoreId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adminChangingId, setAdminChangingId] = useState<string | null>(null);
  // Phase 2: multi-store assignment UI. `assignTarget` is the user we're
  // about to add a store to (the modal opens with them pre-selected).
  const [assignTarget, setAssignTarget] = useState<{ employeeId: string; userId: string; name: string; assignedStoreIds: Set<string> } | null>(null);
  const [assigning, setAssigning] = useState(false);

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
    assignments: Array<{ id: string; storeId: string; storeName: string }>;
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
          assignments: []
        };
        byUser.set(userId, g);
      }
      g.assignments.push({
        id: e.id,
        storeId: e.storeId ?? e.store?.id,
        storeName: e.store?.storeName ?? ""
      });
    }
    return Array.from(byUser.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  async function remove(employeeId: string, name: string) {
    if (!session.token) return;
    if (!window.confirm(`Remove ${name}? They will no longer be able to sign in. Their past closes stay on record.`)) {
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

  async function toggleAdmin(employee: any) {
    if (!session.token) return;
    const employeeId = employee.id;
    const isAdmin = employee.user?.role === "STORE_OWNER";
    setAdminChangingId(employeeId);
    setError(null);
    try {
      const result = await setEmployeeAdminAccess(session.token, employeeId, !isAdmin);
      setEmployees((prev) =>
        prev.map((row: any) =>
          row.id === employeeId
            ? { ...row, user: { ...row.user, role: result.role } }
            : row
        )
      );
      setInfo(!isAdmin ? "Admin access turned on." : "Admin access turned off.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update admin access");
    } finally {
      setAdminChangingId(null);
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
        setInfo("Already assigned to that store.");
      } else {
        // Optimistically add the new assignment to the local list so the
        // chip appears immediately. The next list refresh will reconcile.
        const newStoreName = session.stores.find((s) => s.id === targetStoreId)?.storeName ?? "Store";
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
        setInfo(`${assignTarget.name} can now close ${newStoreName}.`);
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
        `Remove ${name} from ${storeName}? They can no longer close that store. Other store assignments stay.`
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
      const result = await inviteEmployee(session.token, { name, email, storeId });
      setEmployees((prev) => [
        ...prev,
        { id: result.id, user: { name, email }, storeId }
      ]);
      // Show the temp password modal so the owner can share it.
      setResetResult({ email: result.email, tempPassword: result.tempPassword });
      setName("");
      setEmail("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not invite employee");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Employees</h1>
          <p className="text-sm font-bold text-ink/65">Invite the people who close your stores at night.</p>
        </div>
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="focus-ring inline-flex h-11 items-center gap-2 rounded-lg bg-leaf px-4 font-black text-white"
          >
            <Plus size={16} /> Invite
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
          <Field label="Full name">
            <input
              required
              autoFocus
              className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Email">
            <input
              required
              type="email"
              className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Store">
            <select
              required
              className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-3 font-bold"
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
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="focus-ring h-12 flex-1 rounded-lg border-2 border-ink/15 bg-white font-black text-ink hover:bg-smoke"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="focus-ring flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-leaf font-black text-white disabled:opacity-60"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
              {submitting ? "Sending…" : "Send invite"}
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
            Loading employees…
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-xl border border-ink/10 bg-white p-8 text-center text-sm font-bold text-ink/65">
            No employees yet.
          </div>
        ) : (
          grouped.map((g) => (
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
                {g.isAdmin ? <span className="rounded-full bg-leaf/10 px-2 py-0.5 text-xs font-black text-leaf">Admin</span> : null}
              </div>

              {/* Store chips — one per assignment row, with per-chip unassign */}
              <div className="flex flex-wrap items-center gap-2">
                {g.assignments.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-smoke px-2.5 py-1 text-xs font-black text-ink"
                  >
                    <Store size={12} aria-hidden />
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
                  <Plus size={11} /> Assign to another store
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => toggleAdmin({ id: g.primaryEmployeeId, user: { role: g.isAdmin ? "STORE_OWNER" : "EMPLOYEE" } })}
                  disabled={adminChangingId === g.primaryEmployeeId}
                  className={
                    g.isAdmin
                      ? "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-leaf px-3 text-xs font-black text-white disabled:opacity-60"
                      : "focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/15 px-3 text-xs font-black text-ink hover:bg-smoke disabled:opacity-60"
                  }
                  aria-label={g.isAdmin ? "Remove admin access" : "Give admin access"}
                >
                  {adminChangingId === g.primaryEmployeeId ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                  {g.isAdmin ? "Admin" : "Make Admin"}
                </button>
                <button
                  onClick={() => reset(g.primaryEmployeeId)}
                  disabled={resettingId === g.primaryEmployeeId}
                  className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/15 px-3 text-xs font-black text-ink hover:bg-smoke disabled:opacity-60"
                  aria-label="Reset password"
                >
                  {resettingId === g.primaryEmployeeId ? <Loader2 className="animate-spin" size={14} /> : <Key size={14} />}
                  Reset password
                </button>
                {/* Removing the LAST chip via the chip's X already removes
                    the entire user via the existing remove flow. Skip a
                    redundant "remove user" action here. */}
              </div>
            </div>
          ))
        )}
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
            Assign {target.name} to another store
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
            {target.name} is already assigned to every store you own.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm font-bold text-ink/65">
              They'll be able to close this store alongside their existing assignments.
            </p>
            <label className="mt-4 block">
              <span className="text-sm font-black">Store</span>
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
            Cancel
          </button>
          {available.length > 0 ? (
            <button
              type="button"
              onClick={() => onConfirm(storeId)}
              disabled={submitting || !storeId}
              className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-lg bg-leaf px-4 text-sm font-black text-white disabled:opacity-60"
            >
              {submitting ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
              Assign
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
            <p className="text-xs font-black uppercase tracking-wide text-leaf">Password reset</p>
            <h2 className="text-xl font-black">Share this with {email}</h2>
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
          Temporary password — they'll be asked to change it on first sign in.
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-ink/15 bg-smoke px-3 py-3 font-mono text-lg font-black">
          <span className="flex-1 break-all">{tempPassword}</span>
          <button
            onClick={copy}
            className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-md bg-white px-3 text-xs font-black hover:bg-smoke"
          >
            <Copy size={14} /> {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-4 text-xs font-bold text-ink/55">
          Send by text or in person. This password won't be shown again.
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
