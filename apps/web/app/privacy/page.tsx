export const metadata = { title: "Privacy Policy · Daily Close" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl font-black">Privacy Policy</h1>
      <p className="mt-2 text-sm font-bold text-ink/55">Last updated: 2026-05-22</p>
      <div className="mt-6 space-y-4 text-base font-semibold leading-8 text-ink/75">
        <p>
          Daily Close stores account, store, employee, daily close,
          expense, report image, and notification information for the sole
          purpose of running the closing workflow.
        </p>
        <p>
          <strong>What we collect:</strong> name, email, password (hashed by
          Supabase Auth), store details you create, daily close numbers, POS
          report images you upload.
        </p>
        <p>
          <strong>Who sees it:</strong> store owners can see their own stores
          and the employees they invite. Employees can only see the store they
          are assigned to. No data is shared with third parties.
        </p>
        <p>
          <strong>Where it lives:</strong> Supabase Postgres + Storage. Backups
          are managed by Supabase. POS report images are kept for the lifetime
          of the corresponding daily close record.
        </p>
        <p>
          <strong>SMS and phone numbers:</strong> When an owner invites an
          employee by phone number, we collect that phone number and store it
          to send a one-time sign-in SMS. We retain consent records as
          required by carrier regulations. We do not sell phone numbers and
          do not use them for marketing.
        </p>
        <p>
          <strong>Delete my data:</strong> email{" "}
          <a className="underline" href="mailto:support@dailyclose.app">
            support@dailyclose.app
          </a>{" "}
          and we will remove your account and all related records within 30
          days.
        </p>
      </div>
    </main>
  );
}
