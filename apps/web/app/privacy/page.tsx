export const metadata = { title: "Privacy Policy · Daily Close" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl font-black">Privacy Policy</h1>
      <p className="mt-2 text-sm font-bold text-ink/55">Last updated: 2026-06-05</p>

      <div className="mt-6 space-y-6 text-base font-semibold leading-8 text-ink/75">
        <p>
          Daily Close (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps store owners and
          their employees run a daily closing workflow. This policy explains what
          we collect, why, who can see it, and how to delete it. It applies to the
          Daily Close mobile app and the website at dailyclose.us.
        </p>

        <section>
          <h2 className="text-xl font-black text-ink">Information we collect</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>Account information:</strong> your name, email address, and
              password (stored only as a salted hash by Supabase Auth).
            </li>
            <li>
              <strong>Phone number (optional):</strong> if you sign up with a
              phone, add a number for SMS sign-in, or turn on SMS/WhatsApp alerts,
              we store your phone number to send one-time sign-in codes and the
              alerts you enable.
            </li>
            <li>
              <strong>Store &amp; business data:</strong> the stores you create and
              the daily-close figures you enter (sales, cash counted, cash
              over/short, expenses, net profit) and any notes.
            </li>
            <li>
              <strong>Receipt photos:</strong> images of POS/sales receipts and
              expense documents you upload during a close.
            </li>
            <li>
              <strong>Subscription &amp; billing:</strong> your subscription status
              and trial dates. Card payments are processed by Stripe on the web —
              we never see or store your full card number.
            </li>
            <li>
              <strong>Diagnostics:</strong> crash reports and basic technical
              diagnostics (via Sentry) to keep the app stable, and authentication
              tokens to keep you signed in.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-black text-ink">How we use it</h2>
          <p className="mt-2">
            Only to run the closing workflow and your account: to authenticate you,
            show owners their stores&rsquo; results, generate reports, send the
            alerts you enable, process your subscription, and fix crashes. We do
            not use your data for advertising, and we do not sell it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-ink">Who can see it</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              Store owners see their own stores and the employees they invite.
              Employees see only the store(s) they are assigned to.
            </li>
            <li>
              We use trusted service providers that process data on our behalf,
              under contract, solely to provide the service:{" "}
              <strong>Supabase</strong> (database, file storage, authentication),{" "}
              <strong>Render</strong> (API hosting), <strong>Stripe</strong>{" "}
              (subscription billing), <strong>Twilio</strong> (SMS/WhatsApp
              messages), and <strong>Sentry</strong> (crash diagnostics). They may
              not use your data for their own purposes.
            </li>
            <li>
              We do not sell your data, and we do not share it with third parties
              for advertising.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-black text-ink">Where it lives &amp; security</h2>
          <p className="mt-2">
            Your data is stored in Supabase (Postgres database and file storage)
            and transmitted over encrypted (HTTPS) connections. Passwords are
            hashed — we never store them in plain text.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-ink">Data retention</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              Account, store, and daily-close records are kept while your account
              is active.
            </li>
            <li>
              Receipt and expense photos attached to a completed close are kept for
              the life of that close record, so you keep your records, and are
              removed when you delete the close or your account.
            </li>
            <li>
              Receipt photos from an abandoned close (uploaded but never submitted)
              are automatically purged within 7 days.
            </li>
            <li>
              Phone-number consent records are retained as required by carrier
              (A2P/10DLC) regulations.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-black text-ink">Deleting your data</h2>
          <p className="mt-2">
            You can delete your account and all related records at any time,
            directly in the app: <strong>Settings &rarr; Account &rarr; Delete
            account</strong> (also available on the website). This cancels any
            active subscription and removes your stores, closes, receipts, and
            personal information, and blocks future sign-in. You can also email{" "}
            <a className="underline" href="mailto:dailyclose@yahoo.com">
              dailyclose@yahoo.com
            </a>{" "}
            and we will remove your account within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-ink">Children</h2>
          <p className="mt-2">
            Daily Close is a business tool intended for adults (18+). It is not
            directed to children.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-ink">Changes &amp; contact</h2>
          <p className="mt-2">
            We may update this policy; the &ldquo;last updated&rdquo; date above
            reflects the latest version. Questions? Email{" "}
            <a className="underline" href="mailto:dailyclose@yahoo.com">
              dailyclose@yahoo.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
