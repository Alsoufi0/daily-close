export const metadata = { title: "SMS Opt-In Proof · Daily Close" };

export default function SmsOptInProofPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl font-black">SMS Opt-In Proof — Daily Close</h1>
      <p className="mt-2 text-sm font-bold text-ink/55">Last updated: 2026-05-30</p>

      <div className="mt-6 space-y-6 text-base font-semibold leading-8 text-ink/75">
        <section>
          <h2 className="text-2xl font-black text-ink">1. Overview</h2>
          <p className="mt-2">
            Daily Close is a SaaS workforce closing app for retail stores. The
            only outbound SMS we send is a one-time welcome message to a new
            employee when their store owner invites them. Below is the exact
            opt-in flow.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black text-ink">2. Where consent is collected</h2>
          <p className="mt-2">
            Admin → Employees → Add Employee → Phone tab. Required checkbox
            above the Send Invite button.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black text-ink">
            3. Exact consent label shown to the attesting owner
          </h2>
          <blockquote className="mt-2 rounded-md border-l-4 border-ink/30 bg-ink/5 px-4 py-3 italic">
            I confirm this employee has agreed to receive SMS from Daily Close
            at this number. Standard message and data rates may apply.
          </blockquote>
        </section>

        <section>
          <h2 className="text-2xl font-black text-ink">4. Screenshot</h2>
          {/* Inline visual mock that faithfully replicates the Admin -> Employees -> Add Employee -> Phone tab form. */}
          <div className="mt-2 rounded-xl border border-ink/15 bg-white p-5 shadow-sm">
            <div className="mb-4 text-xs font-black uppercase tracking-wide text-ink/55">
              Admin / Employees / Add Employee
            </div>

            <div className="space-y-4">
              {/* Full name field */}
              <label className="block">
                <span className="text-sm font-black">Full name</span>
                <div className="mt-2">
                  <div className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 text-base font-bold flex items-center">
                    Maya Patel
                  </div>
                </div>
              </label>

              {/* Email / Phone tab toggle */}
              <div>
                <div className="mb-2 grid grid-cols-2 rounded-lg bg-smoke p-0.5 text-sm font-black">
                  <div className="px-3 py-1.5 text-center text-ink/55">Email</div>
                  <div className="rounded-md bg-white px-3 py-1.5 text-center shadow-sm">Phone</div>
                </div>

                {/* Phone (E.164) field */}
                <label className="block">
                  <span className="text-sm font-black">Phone (E.164, e.g. +15551234567)</span>
                  <div className="mt-2">
                    <div className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-4 text-base font-bold flex items-center">
                      +15551234567
                    </div>
                  </div>
                </label>
              </div>

              {/* Store field */}
              <label className="block">
                <span className="text-sm font-black">Store</span>
                <div className="mt-2">
                  <div className="focus-ring h-12 w-full rounded-lg border border-ink/15 px-3 text-base font-bold flex items-center">
                    Brooklyn Smoke
                  </div>
                </div>
              </label>

              {/* Required consent checkbox (checked, with visible focus ring) */}
              <div className="flex items-start gap-2 rounded-lg border border-ink/15 bg-smoke/40 p-3 text-sm font-bold text-ink/80 ring-2 ring-leaf/60 ring-offset-2">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-leaf text-white"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
                    <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>
                  I confirm this employee has agreed to receive SMS from Daily
                  Close at this number. Standard message and data rates may
                  apply.
                </span>
              </div>

              {/* Send invite button row */}
              <div className="flex gap-3">
                <div className="focus-ring h-12 flex-1 rounded-lg border-2 border-ink/15 bg-white font-black text-ink flex items-center justify-center">
                  Cancel
                </div>
                <div className="focus-ring flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-leaf font-black text-white">
                  Send invite
                </div>
              </div>
              <p className="text-xs font-bold text-ink/55">
                The Send Invite button is disabled until the consent checkbox
                above is checked. Shown enabled here because the checkbox is
                checked in this mock.
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs font-bold text-ink/55">
            Faithful visual mock of the Add Employee → Phone tab consent UI.
            Reviewer can also view the same UI live in the admin dashboard
            after signup.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black text-ink">5. What we record per invite</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>phone (E.164)</li>
            <li>employee id</li>
            <li>attesting owner user id</li>
            <li>store id</li>
            <li>consent text version</li>
            <li>consent method <code>owner_attestation_v1</code></li>
            <li>UTC timestamp</li>
          </ul>
          <p className="mt-2">
            Stored in <code>phone_consents</code> table; immutable audit row.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black text-ink">6. Sample message</h2>
          <blockquote className="mt-2 whitespace-pre-line rounded-md border-l-4 border-ink/30 bg-ink/5 px-4 py-3 italic">
{`Hi Maya, you've been invited to Brooklyn Smoke on Daily Close.
Sign in at https://dailyclose.us with this number and temporary password: Temp!Pass123
Reply STOP to opt out. Msg&data rates may apply.`}
          </blockquote>
        </section>

        <section>
          <h2 className="text-2xl font-black text-ink">7. Opt-out handling</h2>
          <p className="mt-2">
            STOP / STOPALL / UNSUBSCRIBE / CANCEL / END / QUIT replies are
            processed by our inbound webhook at the Twilio Messaging Service
            and immediately set <code>opted_out_at</code> on every consent row
            for that number. No further SMS is sent to opted-out numbers.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black text-ink">8. Links</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <a className="underline" href="/terms#sms-program">
                Terms — SMS Program
              </a>
            </li>
            <li>
              <a className="underline" href="/privacy">
                Privacy Policy
              </a>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
