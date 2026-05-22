import { ArrowRight, LockKeyhole, Store } from "lucide-react";
import Link from "next/link";

export function LoginDemo() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 py-8 sm:px-6">
      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-lg bg-green-100 px-3 py-2 text-sm font-black text-leaf">
            <Store size={18} aria-hidden />
            Demo Mode
          </div>
          <h1 className="max-w-3xl text-4xl font-black tracking-normal text-ink sm:text-6xl">
            Close your store in 2 minutes.
          </h1>
          <p className="mt-4 max-w-2xl text-xl font-bold leading-8 text-ink/70">
            Stop using paper sheets. Owners see sales, closed stores, and missing cash the moment the day ends.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-smoke">
              <LockKeyhole size={22} aria-hidden />
            </div>
            <div>
              <h2 className="text-2xl font-black">Sign In</h2>
              <p className="font-semibold text-ink/60">Sample login for the demo</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-black">Email</span>
              <input className="focus-ring mt-2 h-12 w-full rounded-lg border px-4 font-bold" defaultValue="owner@demo.com" />
            </label>
            <label className="block">
              <span className="text-sm font-black">Password</span>
              <input className="focus-ring mt-2 h-12 w-full rounded-lg border px-4 font-bold" defaultValue="demo1234" type="password" />
            </label>
          </div>

          <div className="mt-5 grid gap-3">
            <Link className="focus-ring flex h-14 items-center justify-center gap-2 rounded-lg bg-leaf text-lg font-black text-white" href="/owner">
              Open Owner View
              <ArrowRight size={22} aria-hidden />
            </Link>
            <Link className="focus-ring flex h-14 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-white text-lg font-black text-ink" href="/employee">
              Open Employee View
              <ArrowRight size={22} aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
