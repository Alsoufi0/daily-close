"use client";

import { useEffect, useState } from "react";
import { Copy, Key, Loader2, Plus, Trash2, User, X } from "lucide-react";
import { useSession } from "../../../lib/use-session";
import {
  ApiError,
  deleteEmployee,
  inviteEmployee,
  listEmployees,
  resetEmployeePassword
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

      <div className="space-y-2">
        {loading ? (
          <div className="rounded-xl border border-ink/10 bg-white p-6 text-center text-sm font-bold text-ink/55">
            <Loader2 className="mx-auto mb-2 animate-spin" size={18} />
            Loading employees…
          </div>
        ) : employees.length === 0 ? (
          <div className="rounded-xl border border-ink/10 bg-white p-8 text-center text-sm font-bold text-ink/65">
            No employees yet.
          </div>
        ) : (
          employees.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white p-4 shadow-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                <User size={18} aria-hidden />
              </span>
              <div className="flex-1">
                <p className="font-black">{e.user?.name ?? e.name ?? "Employee"}</p>
                <p className="text-xs font-bold text-ink/55">{e.user?.email ?? e.email}</p>
              </div>
              <span className="text-xs font-bold text-ink/55">{e.store?.storeName ?? ""}</span>
              <button
                onClick={() => reset(e.id)}
                disabled={resettingId === e.id}
                className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/15 px-3 text-xs font-black text-ink hover:bg-smoke disabled:opacity-60"
                aria-label="Reset password"
              >
                {resettingId === e.id ? <Loader2 className="animate-spin" size={14} /> : <Key size={14} />}
                Reset
              </button>
              <button
                onClick={() => remove(e.id, e.user?.name ?? e.name ?? "this employee")}
                disabled={deletingId === e.id}
                className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-warning/30 px-3 text-xs font-black text-warning hover:bg-red-50 disabled:opacity-60"
                aria-label="Remove employee"
              >
                {deletingId === e.id ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                Remove
              </button>
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
