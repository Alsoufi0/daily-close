"use client";

import { useState } from "react";
import { Loader2, Plus, Store } from "lucide-react";
import { useSession } from "../../../lib/use-session";
import { ApiError, createStore } from "../../../lib/api-client";

export default function StoresAdminPage() {
  const session = useSession();
  const [showForm, setShowForm] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [closeTime, setCloseTime] = useState("23:30");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session.token) return;
    setSubmitting(true);
    setError(null);
    try {
      const s = await createStore(session.token, {
        storeName,
        address: address || undefined,
        closeTime
      });
      setCreated((prev) => [...prev, s.storeName]);
      setStoreName("");
      setAddress("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create store");
    } finally {
      setSubmitting(false);
    }
  }

  const stores = [...session.stores, ...created.map((n) => ({ id: `local-${n}`, storeName: n }))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Stores</h1>
          <p className="text-sm font-bold text-ink/65">Add the locations you want to close every night.</p>
        </div>
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="focus-ring inline-flex h-11 items-center gap-2 rounded-lg bg-leaf px-4 font-black text-white"
          >
            <Plus size={16} /> New store
          </button>
        ) : null}
      </div>

      {showForm ? (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-ink/10 bg-white p-5 shadow-sm">
          {error ? (
            <div className="rounded-lg border border-warning/30 bg-red-50 p-3 text-sm font-bold text-warning">
              {error}
            </div>
          ) : null}
          <Field label="Store name">
            <input
              required
              autoFocus
              className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
          </Field>
          <Field label="Address (optional)">
            <input
              className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          <Field label="Daily close time">
            <input
              type="time"
              className="focus-ring h-12 w-44 rounded-lg border border-ink/15 px-4 font-bold"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
            />
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
              {submitting ? "Creating…" : "Create store"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-2">
        {stores.length === 0 ? (
          <div className="rounded-xl border border-ink/10 bg-white p-8 text-center">
            <p className="text-base font-bold text-ink/65">No stores yet.</p>
          </div>
        ) : (
          stores.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white p-4 shadow-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf/10 text-leaf">
                <Store size={18} aria-hidden />
              </span>
              <p className="font-black">{s.storeName}</p>
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
