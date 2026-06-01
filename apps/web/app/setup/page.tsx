"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, Store, UserPlus } from "lucide-react";
import { getBrowserTimeZone, getSupportedTimeZones } from "@dailyclose/shared/timezones";
import { useSession } from "../../lib/use-session";
import { ApiError, createStore, inviteEmployee } from "../../lib/api-client";
import { RequireAuth } from "../../components/require-auth";

type Step = "store" | "employee" | "done";

export default function SetupPage() {
  return (
    <RequireAuth allowedRoles={["STORE_OWNER", "SUPER_ADMIN"]}>
      <SetupPageInner />
    </RequireAuth>
  );
}

function SetupPageInner() {
  const session = useSession();
  const router = useRouter();
  const [step, setStep] = useState<Step>("store");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const browserTz = getBrowserTimeZone();
  const timeZones = useMemo(() => getSupportedTimeZones(), []);
  // form state
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [closeTime, setCloseTime] = useState("23:30");
  const [timezone, setTimezone] = useState(browserTz);
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");

  async function submitStore(e: React.FormEvent) {
    e.preventDefault();
    if (!session.token) {
      setError("You need to sign in first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createStore(session.token, {
        storeName,
        address: storeAddress || undefined,
        closeTime,
        timezone
      });
      setStoreId(created.id);
      setStep("employee");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create store");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!session.token || !storeId) return;
    setSubmitting(true);
    setError(null);
    try {
      await inviteEmployee(session.token, {
        name: empName,
        email: empEmail,
        storeId
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not invite employee");
    } finally {
      setSubmitting(false);
    }
  }

  function skipEmployee() {
    setStep("done");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <header className="mb-6 text-center">
        <p className="text-sm font-black uppercase tracking-wide text-leaf">First-run setup</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink sm:text-4xl">
          Welcome{session.profile?.name ? `, ${session.profile.name}` : ""}.
        </h1>
        <p className="mt-2 text-base font-bold text-ink/65">
          Two quick steps to get your first store closing tonight.
        </p>
      </header>

      <ol className="mb-8 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-wide">
        <StepDot label="Store" state={step === "store" ? "current" : "done"} />
        <span className="h-px w-8 bg-ink/15" aria-hidden />
        <StepDot
          label="Employee"
          state={step === "employee" ? "current" : step === "done" ? "done" : "todo"}
        />
        <span className="h-px w-8 bg-ink/15" aria-hidden />
        <StepDot label="Done" state={step === "done" ? "current" : "todo"} />
      </ol>

      <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
        {error ? (
          <div className="mb-4 rounded-lg border border-warning/30 bg-red-50 p-3 text-sm font-bold text-warning">
            {error}
          </div>
        ) : null}

        {step === "store" ? (
          <form onSubmit={submitStore} className="space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <Store size={22} aria-hidden /> Create your first store
            </h2>
            <Field label="Store name">
              <input
                required
                className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </Field>
            <Field label="Address (optional)">
              <input
                className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
              />
            </Field>
            <Field label="Daily close time">
              <input
                type="time"
                className="focus-ring h-12 w-44 rounded-lg border border-ink/15 px-4 font-bold"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
              />
              <p className="mt-1 text-xs font-bold text-ink/55">
                Used to send a missed-close alert if no one submits by this time.
              </p>
            </Field>
            <Field label="Timezone">
              <select
                className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {timeZones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                    {zone === browserTz ? " (detected)" : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs font-bold text-ink/55">
                Detected from your device. Pick the store's real timezone so close
                times and missed-close alerts follow the store's clock — not yours. ({browserTz})
              </p>
            </Field>
            <button
              type="submit"
              disabled={submitting}
              className="focus-ring flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-leaf text-lg font-black text-white disabled:opacity-60"
            >
              {submitting ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
              {submitting ? "Creating…" : "Create store"}
            </button>
          </form>
        ) : null}

        {step === "employee" ? (
          <form onSubmit={submitEmployee} className="space-y-4">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <UserPlus size={22} aria-hidden /> Invite your first employee
            </h2>
            <p className="text-sm font-bold text-ink/65">
              They'll get an email with a sign-in link. You can do this later from the Employees page.
            </p>
            <Field label="Employee name">
              <input
                required
                className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                value={empName}
                onChange={(e) => setEmpName(e.target.value)}
              />
            </Field>
            <Field label="Employee email">
              <input
                required
                type="email"
                className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                value={empEmail}
                onChange={(e) => setEmpEmail(e.target.value)}
              />
            </Field>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={skipEmployee}
                className="focus-ring h-14 flex-1 rounded-lg border-2 border-ink/15 bg-white text-base font-black text-ink hover:bg-smoke"
              >
                Skip for now
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="focus-ring flex h-14 flex-1 items-center justify-center gap-2 rounded-lg bg-leaf text-base font-black text-white disabled:opacity-60"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                {submitting ? "Sending…" : "Send invite"}
              </button>
            </div>
          </form>
        ) : null}

        {step === "done" ? (
          <div className="space-y-5 py-4 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-leaf/10 text-leaf">
              <Check size={32} aria-hidden />
            </span>
            <h2 className="text-2xl font-black">You're set up.</h2>
            <p className="text-base font-bold text-ink/65">
              Open the owner dashboard to see tonight's close as it happens.
            </p>
            <button
              onClick={() => router.push("/owner")}
              className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-leaf px-6 font-black text-white"
            >
              Go to dashboard <ArrowRight size={18} />
            </button>
          </div>
        ) : null}
      </div>
    </main>
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

function StepDot({ label, state }: { label: string; state: "todo" | "current" | "done" }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          state === "current"
            ? "flex h-7 w-7 items-center justify-center rounded-full bg-leaf text-white"
            : state === "done"
              ? "flex h-7 w-7 items-center justify-center rounded-full bg-leaf/15 text-leaf"
              : "flex h-7 w-7 items-center justify-center rounded-full bg-smoke text-ink/45"
        }
      >
        {state === "done" ? <Check size={14} /> : ""}
      </span>
      <span
        className={
          state === "current" ? "text-leaf" : state === "done" ? "text-ink/70" : "text-ink/45"
        }
      >
        {label}
      </span>
    </div>
  );
}
