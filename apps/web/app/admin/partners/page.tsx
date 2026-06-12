"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Users } from "lucide-react";
import { RequireAuth } from "../../../components/require-auth";
import { RefQr } from "../../../components/ref-qr";
import { useSession } from "../../../lib/use-session";
import {
  ApiError,
  PartnerRecord,
  createPartner,
  listPartners,
  updatePartner
} from "../../../lib/api-client";

function refUrl(refCode: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/r/${refCode}`;
}

function PartnersInner() {
  const session = useSession();
  const [partners, setPartners] = useState<PartnerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [justCreated, setJustCreated] = useState<PartnerRecord | null>(null);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [payout, setPayout] = useState("");
  const [ratePct, setRatePct] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!session.token) return;
    try {
      setPartners(await listPartners(session.token));
    } catch {
      setPartners([]);
    }
  }

  useEffect(() => {
    if (!session.token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    listPartners(session.token)
      .then((p) => !cancelled && setPartners(p))
      .catch(() => !cancelled && setPartners([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session.token) return;
    setSaving(true);
    setError(null);
    try {
      const pct = ratePct.trim() ? Number(ratePct) : undefined;
      if (pct !== undefined && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
        throw new Error("Rate must be a percentage between 0 and 100.");
      }
      const created = await createPartner(session.token, {
        name: name.trim(),
        contact: contact.trim() || undefined,
        payoutDetails: payout.trim() || undefined,
        commissionRate: pct !== undefined ? pct / 100 : undefined
      });
      setJustCreated(created);
      setName("");
      setContact("");
      setPayout("");
      setRatePct("");
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: PartnerRecord) {
    if (!session.token) return;
    try {
      await updatePartner(session.token, p.id, { active: !p.active });
      await refresh();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not update partner.");
    }
  }

  const rows = useMemo(() => partners, [partners]);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-ink/55">
        <Loader2 className="animate-spin" size={20} aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-black text-ink">
          <Users size={18} aria-hidden /> Partners
        </h1>
        <button
          type="button"
          onClick={() => {
            setShowCreate((s) => !s);
            setJustCreated(null);
          }}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-leaf px-3 py-2 text-sm font-black text-white hover:bg-leaf/90"
        >
          <Plus size={16} aria-hidden /> New partner
        </button>
      </div>

      {justCreated && (
        <div className="rounded-xl border border-leaf/30 bg-leaf/5 p-4">
          <p className="mb-3 text-sm font-bold text-ink">
            Partner <span className="text-leaf">{justCreated.name}</span> created — code{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono">{justCreated.refCode}</code>.
            Share this QR / link:
          </p>
          <RefQr url={refUrl(justCreated.refCode)} label={justCreated.name} />
        </div>
      )}

      {showCreate && (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
          {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-bold text-ink/75">Name *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="w-full rounded-lg border border-ink/15 px-3 py-2"
                placeholder="Distributor name"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-bold text-ink/75">Contact</span>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full rounded-lg border border-ink/15 px-3 py-2"
                placeholder="Email or phone"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-bold text-ink/75">Payout details</span>
              <input
                value={payout}
                onChange={(e) => setPayout(e.target.value)}
                className="w-full rounded-lg border border-ink/15 px-3 py-2"
                placeholder="How they get paid (bank, PayPal…)"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-bold text-ink/75">Rate override (%)</span>
              <input
                value={ratePct}
                onChange={(e) => setRatePct(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-lg border border-ink/15 px-3 py-2"
                placeholder="Leave blank for platform default"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-leaf px-4 py-2 text-sm font-black text-white hover:bg-leaf/90 disabled:opacity-60"
          >
            {saving && <Loader2 className="animate-spin" size={15} aria-hidden />} Create partner
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-ink/10 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">Partner</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Scans</th>
              <th className="px-4 py-3">Referred</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink/50">
                  No partners yet. Create one to generate a referral QR.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 font-bold text-ink">
                  <Link href={`/admin/partners/${p.id}`} className="hover:text-leaf">
                    {p.name}
                  </Link>
                  {p.contact && <div className="text-xs font-normal text-ink/50">{p.contact}</div>}
                </td>
                <td className="px-4 py-3 font-mono text-ink/80">{p.refCode}</td>
                <td className="px-4 py-3 text-ink/80">
                  {p.commissionRate === null ? (
                    <span className="text-ink/45">default</span>
                  ) : (
                    `${(p.commissionRate * 100).toFixed(2)}%`
                  )}
                </td>
                <td className="px-4 py-3 text-ink/80">{p.scanCount}</td>
                <td className="px-4 py-3 text-ink/80">{p.referredOwnerCount ?? 0}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      p.active
                        ? "rounded-full bg-leaf/10 px-2 py-0.5 text-xs font-bold text-leaf"
                        : "rounded-full bg-ink/10 px-2 py-0.5 text-xs font-bold text-ink/50"
                    }
                  >
                    {p.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleActive(p)}
                    className="focus-ring rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-bold text-ink/70 hover:bg-smoke"
                  >
                    {p.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PartnersAdminPage() {
  return (
    <RequireAuth allowedRoles={["SUPER_ADMIN"]}>
      <PartnersInner />
    </RequireAuth>
  );
}
