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
      </div>
    </main>
  );
}
