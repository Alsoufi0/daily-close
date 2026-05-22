export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-4xl font-black">Terms of Service</h1>
      <div className="mt-5 space-y-4 text-lg font-semibold leading-8 text-ink/75">
        <p>SmokeShop Daily Close helps stores submit daily closing records. Store owners are responsible for reviewing submitted numbers and resolving cash differences.</p>
        <p>The pilot version may use mock report reading while uploaded images and entered numbers are stored for daily close records.</p>
        <p>Production deployments should add billing terms, cancellation terms, liability limits, support contacts, and governing law before launch.</p>
      </div>
    </main>
  );
}
