"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Mail, MessageSquareText, Phone, Send, Store } from "lucide-react";

type Status = "idle" | "loading" | "sent" | "fallback" | "error";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [storeCount, setStoreCount] = useState("1 store");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const mailto = useMemo(() => {
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone || "Not provided"}`,
      `Stores: ${storeCount || "Not provided"}`,
      "",
      message
    ].join("\n");
    return `mailto:dailyclose@yahoo.com?subject=${encodeURIComponent("Daily Close contact")}&body=${encodeURIComponent(body)}`;
  }, [email, message, name, phone, storeCount]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      storeCount,
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
      if (!response.ok) throw new Error(data?.message || "Could not send your message.");
      if (data?.sent) {
        setStatus("sent");
      } else {
        window.location.href = mailto;
        setStatus("fallback");
      }
    } catch (err: any) {
      setError(err?.message || "Could not send your message.");
      setStatus("error");
    }
  }

  return (
    <main className="bg-soft">
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-16">
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-leaf/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-leaf">
            <MessageSquareText size={14} aria-hidden />
            Contact
          </span>
          <h1 className="mt-5 max-w-xl text-4xl font-black leading-tight tracking-tight text-ink sm:text-5xl">
            Talk to Daily Close before your next store close.
          </h1>
          <p className="mt-4 max-w-xl text-lg font-bold leading-8 text-ink/70">
            Tell us how many stores you run, what POS you use, and what you need fixed first.
            We will reply at <span className="text-ink">dailyclose@yahoo.com</span>.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <InfoCard icon={Store} title="Pilot stores" body="Setup help for owners and employees." />
            <InfoCard icon={Phone} title="Phone first" body="Built for closing from a store phone." />
            <InfoCard icon={Mail} title="Fast reply" body="Your message goes to Daily Close." />
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name">
              <input
                required
                autoFocus
                className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                autoComplete="email"
                className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 font-bold"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label="Phone">
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
            <Field label="How many stores?">
              <select
                className="focus-ring h-12 w-full rounded-lg border border-ink/15 bg-white px-4 font-bold"
                value={storeCount}
                onChange={(event) => setStoreCount(event.target.value)}
              >
                <option>1 store</option>
                <option>2-3 stores</option>
                <option>4-10 stores</option>
                <option>More than 10 stores</option>
              </select>
            </Field>
          </div>

          <Field label="What should we help with?" className="mt-4">
            <textarea
              required
              minLength={10}
              rows={6}
              className="focus-ring w-full rounded-lg border border-ink/15 px-4 py-3 font-bold leading-6"
              placeholder="Example: I want employees to upload Clover reports and owners to see missing cash."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </Field>

          {status === "sent" ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-leaf/10 p-3 text-sm font-black text-leaf">
              <CheckCircle2 size={18} aria-hidden />
              Message sent to Daily Close.
            </div>
          ) : null}
          {status === "fallback" ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm font-black text-amber-700">
              <Mail size={18} aria-hidden />
              Your email app opened with the message ready for dailyclose@yahoo.com.
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
              {status === "loading" ? "Sending..." : "Send message"}
            </button>
            <a
              href={mailto}
              className="focus-ring inline-flex h-14 items-center justify-center rounded-lg border-2 border-ink/15 bg-white px-5 font-black text-ink"
            >
              Email directly
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
