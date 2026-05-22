"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, User } from "lucide-react";
import { useSession } from "../../../lib/use-session";
import { ApiError, inviteEmployee, listEmployees } from "../../../lib/api-client";

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session.token) return;
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      const result: any = await inviteEmployee(session.token, { name, email, storeId });
      setInfo(
        result.invitedViaSupabase
          ? `${name} has been invited by email.`
          : `${name} added. (Supabase not configured — they can sign in once you wire auth.)`
      );
      setEmployees((prev) => [
        ...prev,
        { id: result.id, user: { name, email }, storeId }
      ]);
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
            </div>
          ))
        )}
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
