import type { Metadata } from "next";
import { Pricing } from "../../components/marketing/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Per-store pricing with a 14-day free trial. No setup fee, cancel anytime. Employees close for free.",
  alternates: { canonical: "/pricing" },
  // Held back from public/search discovery until the new tiered pricing goes
  // live in Stripe — the page is unlinked from nav + noindexed meanwhile. The
  // page itself still works at /pricing for internal review. Remove `robots` to
  // re-expose. See docs/PRICING_TIERED_GOLIVE.md.
  robots: { index: false, follow: false }
};

export default function PricingPage() {
  return <Pricing />;
}
