import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-ink/10 bg-white/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm font-bold text-ink/65 sm:flex-row sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} Daily Close.</p>
        <nav className="flex items-center gap-4">
          <Link className="focus-ring rounded px-1 hover:text-ink" href="/privacy">
            Privacy
          </Link>
          <Link className="focus-ring rounded px-1 hover:text-ink" href="/terms">
            Terms
          </Link>
          <Link className="focus-ring rounded px-1 hover:text-ink" href="/demo">
            Demo
          </Link>
        </nav>
      </div>
    </footer>
  );
}
