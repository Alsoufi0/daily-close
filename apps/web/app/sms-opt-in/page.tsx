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
          {/* TODO: replace this placeholder with a real screenshot at /sms-opt-in-screenshot.png before Twilio submission */}
          <div className="mt-2 flex items-center justify-center rounded-md border-2 border-dashed border-ink/30 bg-ink/5 px-6 py-16 text-center text-sm font-bold text-ink/55">
            Screenshot of the invite form with the consent checkbox required to
            enable Send Invite.
          </div>
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
