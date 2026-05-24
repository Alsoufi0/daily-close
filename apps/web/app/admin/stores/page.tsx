"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { getBrowserTimeZone, getSupportedTimeZones } from "@smokeshop/shared/timezones";
import { useLanguage } from "../../../components/language-provider";
import { useSession } from "../../../lib/use-session";
import {
  ApiError,
  CreateStoreInput,
  createStore,
  deleteStore,
  listStores,
  StoreRecord,
  updateStore
} from "../../../lib/api-client";

interface StoreRowWithMeta extends StoreRecord {
  address?: string | null;
  phone?: string | null;
  timezone?: string;
  closeTime?: string;
}

export default function StoresAdminPage() {
  const session = useSession();
  const { t } = useLanguage();
  const [stores, setStores] = useState<StoreRowWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<StoreRowWithMeta | null>(null);

  useEffect(() => {
    if (!session.token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    listStores(session.token)
      .then((s) => !cancelled && setStores(s as StoreRowWithMeta[]))
      .catch(() => !cancelled && setStores([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  async function refresh() {
    if (!session.token) return;
    try {
      const s = await listStores(session.token);
      setStores(s as StoreRowWithMeta[]);
      window.dispatchEvent(new Event("dailyclose:stores-changed"));
    } catch {
      /* noop */
    }
  }

  async function remove(s: StoreRowWithMeta) {
    if (!session.token) return;
    if (!window.confirm(t("admin.removeStoreConfirm").replace("{store}", s.storeName))) return;
    try {
      await deleteStore(session.token, s.id);
      await refresh();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : t("admin.removeStoreFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">{t("admin.stores")}</h1>
          <p className="text-sm font-bold text-ink/65">{t("admin.storesHelp")}</p>
        </div>
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="focus-ring inline-flex h-11 items-center gap-2 rounded-lg bg-leaf px-4 font-black text-white"
          >
            <Plus size={16} /> {t("admin.newStore")}
          </button>
        ) : null}
      </div>

      {showCreate ? (
        <StoreForm
          mode="create"
          token={session.token}
          onCancel={() => setShowCreate(false)}
          onSaved={async () => {
            setShowCreate(false);
            await refresh();
          }}
        />
      ) : null}

      {editing ? (
        <StoreForm
          mode="edit"
          initial={editing}
          token={session.token}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      ) : null}

      <div className="space-y-2">
        {loading ? (
          <div className="rounded-xl border border-ink/10 bg-white p-6 text-center text-sm font-bold text-ink/55">
            <Loader2 className="mx-auto mb-2 animate-spin" size={18} /> {t("admin.loadingStores")}
          </div>
        ) : stores.length === 0 ? (
          <div className="rounded-xl border border-ink/10 bg-white p-8 text-center">
            <p className="text-base font-bold text-ink/65">{t("admin.noStoresAdd")}</p>
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
              <div className="min-w-0 flex-1">
                <p className="font-black">{s.storeName}</p>
                <p className="truncate text-xs font-bold text-ink/55">
                  {t("dashboard.closesAt")} {s.closeTime ?? "23:30"}
                  {s.timezone ? ` · ${s.timezone}` : ""}
                  {s.address ? ` · ${s.address}` : ""}
                </p>
              </div>
              <button
                onClick={() => setEditing(s)}
                aria-label={t("admin.editStore")}
                className="focus-ring rounded-lg p-2 text-ink/60 hover:bg-smoke hover:text-ink"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => remove(s)}
                aria-label={t("admin.removeStore")}
                className="focus-ring rounded-lg p-2 text-warning hover:bg-red-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StoreForm({
  mode,
  initial,
  token,
  onCancel,
  onSaved
}: {
  mode: "create" | "edit";
  initial?: StoreRowWithMeta;
  token?: string;
  onCancel: () => void;
  onSaved: (s: StoreRowWithMeta) => void;
}) {
  const { t } = useLanguage();
  const browserTz = getBrowserTimeZone();
  const timeZones = useMemo(() => getSupportedTimeZones(), []);
  const [storeName, setStoreName] = useState(initial?.storeName ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [closeTime, setCloseTime] = useState(initial?.closeTime ?? "23:30");
  const [timezone, setTimezone] = useState(initial?.timezone ?? browserTz);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const input: CreateStoreInput = {
        storeName,
        address: address || undefined,
        closeTime,
        timezone
      };
      const r = mode === "create" ? await createStore(token, input) : await updateStore(token, initial!.id, input);
      onSaved(r as StoreRowWithMeta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.saveStoreFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-ink/10 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black">
        {mode === "create" ? t("admin.newStore") : `${t("common.edit")} ${initial?.storeName}`}
      </h2>
      {error ? (
        <div className="rounded-lg border border-warning/30 bg-red-50 p-3 text-sm font-bold text-warning">
          {error}
        </div>
      ) : null}
      <Field label={t("admin.storeName")}>
        <input
          required
          autoFocus
          className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
        />
      </Field>
      <Field label={t("admin.addressOptional")}>
        <input
          className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
          value={address ?? ""}
          onChange={(e) => setAddress(e.target.value)}
        />
      </Field>
      <Field label={t("admin.dailyCloseTime")}>
        <input
          type="time"
          className="focus-ring h-12 w-44 rounded-lg border border-ink/15 px-4 font-bold"
          value={closeTime}
          onChange={(e) => setCloseTime(e.target.value)}
        />
      </Field>
      <Field label={t("admin.timezone")}>
        <select
          className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
        >
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
              {zone === browserTz ? ` (${t("admin.detectedTimezone")})` : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs font-bold text-ink/55">
          {t("admin.timezoneHelp")} ({browserTz})
        </p>
      </Field>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring h-12 flex-1 rounded-lg border-2 border-ink/15 bg-white font-black text-ink hover:bg-smoke"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="focus-ring flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-leaf font-black text-white disabled:opacity-60"
        >
          {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
          {submitting ? t("admin.saving") : mode === "create" ? t("admin.createStore") : t("admin.saveChanges")}
        </button>
      </div>
    </form>
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
