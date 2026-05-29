export const metadata = { title: "Terms of Service · Daily Close" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-4xl font-black">Terms of Service</h1>
      <p className="mt-2 text-sm font-bold text-ink/55">Last updated: 2026-05-22</p>
      <div className="mt-6 space-y-4 text-base font-semibold leading-8 text-ink/75">
        <p>
          Daily Close is a subscription service for retail owners
          and their employees to submit and review daily closing records.
        </p>
        <p>
          <strong>Your data.</strong> Store owners are responsible for the
          accuracy of the numbers their employees submit and for resolving any
          cash differences identified by the application.
        </p>
        <p>
          <strong>Subscription.</strong> Billing is $29 USD per store per
          month, charged in advance, after a 14-day free trial. You can cancel
          at any time from the Billing page. Refunds are at our discretion for
          partial months.
        </p>
        <p>
          <strong>Image processing.</strong> Uploaded POS report images are
          stored securely and used to assist data entry. We do not share them
          with third parties.
        </p>
        <p>
          <strong>Liability.</strong> Daily Close is provided "as is."
          We make no warranty that the service will be uninterrupted or
          error-free. Our maximum aggregate liability is limited to the fees
          paid in the prior 12 months.
        </p>
        <p>
          For support, contact{" "}
          <a className="underline" href="mailto:support@dailyclose.app">
            support@dailyclose.app
          </a>
          .
        </p>

        <h2 id="sms-program" className="pt-6 text-2xl font-black text-ink">
          SMS Program Terms
        </h2>
        <p>
          <strong>Program name:</strong> Daily Close Employee Invites.
        </p>
        <p>
          <strong>Who sends messages:</strong> Daily Close.
        </p>
        <p>
          <strong>Message types:</strong> a one-time welcome SMS containing
          sign-in credentials when a store owner invites an employee, plus
          occasional account or security notifications.
        </p>
        <p>
          <strong>Message frequency:</strong> low — typically one message
          per invite, plus rare account or security alerts.
        </p>
        <p>
          <strong>Costs:</strong> Message and data rates may apply. Carrier
          fees may apply.
        </p>
        <p>
          <strong>Opt-out:</strong> Reply STOP to any message to unsubscribe.
          Reply HELP for help.
        </p>
        <p>
          <strong>Contact:</strong> Email{" "}
          <a className="underline" href="mailto:support@dailyclose.app">
            support@dailyclose.app
          </a>{" "}
          for help. {/* TODO: confirm final support address before A2P submission */}
        </p>
        <p>
          See our{" "}
          <a className="underline" href="/privacy">
            Privacy Policy
          </a>{" "}
          for how we handle phone numbers and consent records.
        </p>
      </div>
    </main>
  );
}
