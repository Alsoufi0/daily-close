import type { Metadata } from "next";
import { Pricing } from "../../components/marketing/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple per-store pricing from $29/month — the rate per store drops as you grow. 14-day free trial, no setup fee, cancel anytime. Employees close for free.",
  alternates: { canonical: "/pricing" }
};

// FAQ rich-result data (mirrors the English FAQ shown on the page). Static so it
// is present in the server-rendered HTML for Google to read.
const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    ["Is there a setup fee?", "No. You pay from $29 per store, per month. Nothing else."],
    ["Can I cancel anytime?", "Yes. Cancel from the Billing page; you keep access until the end of the period you've already paid for."],
    ["What happens when I add a store?", "Your subscription adjusts automatically, prorated for the rest of the month."],
    ["Do my employees pay?", "No. Only owners are billed. Employees close for free from their phone."]
  ].map(([q, a]) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a }
  }))
};

export default function PricingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Pricing />
    </>
  );
}
