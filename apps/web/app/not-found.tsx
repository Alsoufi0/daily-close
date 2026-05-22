import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-leaf/10 text-leaf">
        <Compass size={28} aria-hidden />
      </span>
      <p className="mt-4 text-xs font-black uppercase tracking-wide text-leaf">404</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink sm:text-4xl">
        That page wandered off.
      </h1>
      <p className="mt-3 max-w-md text-base font-bold text-ink/65">
        The link is broken, or the page was moved. Head back to your dashboard.
      </p>
      <Link
        href="/"
        className="focus-ring mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-leaf px-5 font-black text-white"
      >
        <ArrowLeft size={16} aria-hidden /> Back home
      </Link>
    </main>
  );
}
