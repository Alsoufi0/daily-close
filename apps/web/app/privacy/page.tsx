export const metadata = { title: "Privacy Policy · Daily Close" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl font-black">Privacy Policy</h1>
      <p className="mt-2 text-sm font-bold text-ink/55">Last updated: 2026-06-10</p>
      <div className="mt-6 space-y-4 text-base font-semibold leading-8 text-ink/75">
        <p>
          Daily Close helps store owners and their staff close out the register
          at the end of the day. We collect only the information needed to run
          that workflow, and we do not sell your data or use it for advertising.
        </p>
        <p>
          <strong>What we collect:</strong> your name, email address, and
          password (the password is hashed by Supabase Auth and never visible to
          us); a phone number if you choose to sign in or be invited by phone;
          the stores, employees, daily close numbers, and expenses you enter;
          and the point-of-sale report photos you upload.
        </p>
        <p>
          <strong>How we use it:</strong> to create and secure your account, run
          the nightly closing, read the sales total from the report photo, show
          owners their stores, send sign-in codes and close reminders, and
          produce the reports you export.
        </p>
        <p>
          <strong>Who can see it:</strong> owners can see their own stores and
          the employees they invite; employees can see only the store they are
          assigned to. We do not sell your data and do not share it with anyone
          for their own use.
        </p>
        <p>
          <strong>Service providers we use:</strong> we rely on a small number
          of vendors that process data only to provide their service to us, under
          their own privacy and security commitments:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Supabase: database, authentication, and file storage.</li>
          <li>
            Google Cloud Vision: reads the sales total from the report photo
            you upload (optical character recognition).
          </li>
          <li>Twilio: delivers one-time sign-in codes and alerts by SMS or WhatsApp.</li>
          <li>Stripe: processes subscription billing for owners on our website.</li>
          <li>Resend: sends transactional email such as invites and password resets.</li>
          <li>Sentry: collects crash and performance diagnostics so we can fix problems.</li>
        </ul>
        <p>
          <strong>Where it lives and how long:</strong> data is stored in
          Supabase Postgres and Storage, with backups managed by Supabase.
          Report photos are kept for the lifetime of the daily close record they
          belong to.
        </p>
        <p>
          <strong>SMS and phone numbers:</strong> when you sign in by phone or an
          owner invites an employee by phone number, we store that number to send
          a one-time code and any reminders, and we keep consent records as
          required by carrier rules. We do not sell phone numbers or use them for
          marketing.
        </p>
        <p>
          <strong>Diagnostics:</strong> the app reports crashes and performance
          data through Sentry to help us keep it stable. This does not include
          advertising identifiers, and we do not track you across other apps or
          websites.
        </p>
        <p>
          <strong>Delete your data:</strong> you can delete your account at any
          time from inside the app (Settings, then Delete account), which removes
          your account and related records. You can also email{" "}
          <a className="underline" href="mailto:dailyclose@yahoo.com">
            dailyclose@yahoo.com
          </a>{" "}
          and we will remove your account and all related records within 30 days.
        </p>
        <p>
          <strong>Contact:</strong> questions about this policy or your data can
          be sent to{" "}
          <a className="underline" href="mailto:dailyclose@yahoo.com">
            dailyclose@yahoo.com
          </a>
          .
        </p>
      </div>
    </main>
  );
}
