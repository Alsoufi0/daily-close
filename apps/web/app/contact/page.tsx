"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Mail, MessageSquareText, Phone, Send, Store } from "lucide-react";
import { useLanguage } from "../../components/language-provider";

type Status = "idle" | "loading" | "sent" | "fallback" | "error";
type StoreCount = "1" | "2-3" | "4-10" | "10+";

const storeOptions: Array<{ value: StoreCount; labelKey: string }> = [
  { value: "1", labelKey: "contact.storeOne" },
  { value: "2-3", labelKey: "contact.storeTwoThree" },
  { value: "4-10", labelKey: "contact.storeFourTen" },
  { value: "10+", labelKey: "contact.storeMoreTen" }
];

export default function ContactPage() {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [storeCount, setStoreCount] = useState<StoreCount>("1");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const selectedStoreLabel = t(storeOptions.find((option) => option.value === storeCount)?.labelKey || "contact.storeOne");

  const mailto = useMemo(() => {
    const body = [
      `${t("contact.mailName")}: ${name}`,
      `${t("contact.mailEmail")}: ${email}`,
      `${t("contact.mailPhone")}: ${phone || t("contact.notProvided")}`,
      `${t("contact.mailStores")}: ${selectedStoreLabel || t("contact.notProvided")}`,
      "",
      message
    ].join("\n");
    return `mailto:dailyclose@yahoo.com?subject=${encodeURIComponent(t("contact.mailSubject"))}&body=${encodeURIComponent(body)}`;
  }, [email, message, name, phone, selectedStoreLabel, t]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      storeCount: selectedStoreLabel,
      message: message.trim()
    };
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      window.location.href = mailto;
      setStatus("fallback");
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/notifications/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(t("contact.sendFailed"));
      if (data?.sent) {
        setStatus("sent");
      } else {
        window.location.href = mailto;
        setStatus("fallback");
      }
    } catch (err: any) {
      setError(err?.message || t("contact.sendFailed"));
      setStatus("error");
    }
  }

  return (
    <main className="bg-soft">
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-16">
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-leaf/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-leaf">
            <MessageSquareText size={14} aria-hidden />
            {t("contact.badge")}
          </span>
          <h1 className="mt-5 max-w-xl text-4xl font-black leading-tight tracking-tight text-ink sm:text-5xl">
            {t("contact.title")}
          </h1>
          <p className="mt-4 max-w-xl text-lg font-bold leading-8 text-ink/70">
            {t("contact.body")} {t("contact.reply")} <span className="text-ink">dailyclose@yahoo.com</span>.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <InfoCard icon={Store} title={t("contact.pilotTitle")} body={t("contact.pilotBody")} />
            <InfoCard icon={Phone} title={t("contact.phoneTitle")} body={t("contact.phoneBody")} />
            <InfoCard icon={Mail} title={t("contact.replyTitle")} body={t("contact.replyBody")} />
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("contact.name")}>
              <input
                required
                autoFocus
                className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label={t("contact.email")}>
              <input
                required
                type="email"
                autoComplete="email"
                className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label={t("contact.phone")}>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+15551234567"
                className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </Field>
            <Field label={t("contact.storeCount")}>
              <select
                className="focus-ring h-12 w-full rounded-lg border border-ink/15 bg-white px-4 font-bold"
                value={storeCount}
                onChange={(event) => setStoreCount(event.target.value as StoreCount)}
              >
                {storeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={t("contact.help")} className="mt-4">
            <textarea
              required
              minLength={10}
              rows={6}
              className="focus-ring w-full rounded-lg border border-ink/15 px-4 py-3 font-bold leading-6"
              placeholder={t("contact.placeholder")}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </Field>

          {status === "sent" ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-leaf/10 p-3 text-sm font-black text-leaf">
              <CheckCircle2 size={18} aria-hidden />
              {t("contact.sent")}
            </div>
          ) : null}
          {status === "fallback" ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm font-black text-amber-700">
              <Mail size={18} aria-hidden />
              {t("contact.fallback")}
            </div>
          ) : null}
          {status === "error" && error ? (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-warning">{error}</div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={status === "loading"}
              className="focus-ring inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-lg bg-leaf px-5 text-lg font-black text-white shadow-sm disabled:opacity-60"
            >
              {status === "loading" ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} aria-hidden />}
              {status === "loading" ? t("contact.sending") : t("contact.send")}
            </button>
            <a
              href={mailto}
              className="focus-ring inline-flex h-14 items-center justify-center rounded-lg border-2 border-ink/15 bg-white px-5 font-black text-ink"
            >
              {t("contact.emailDirect")}
            </a>
          </div>
        </form>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
  className = ""
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-black text-ink">{label}</span>
      {children}
    </label>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body
}: {
  icon: typeof Store;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
      <Icon className="text-leaf" size={22} aria-hidden />
      <h2 className="mt-3 text-base font-black text-ink">{title}</h2>
      <p className="mt-1 text-sm font-bold leading-6 text-ink/60">{body}</p>
    </div>
  );
}
