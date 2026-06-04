import type { Metadata } from "next";
import { Pricing } from "../../components/marketing/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple per-store pricing: $49.99 per store / month with a 14-day free trial. No setup fee, cancel anytime. Employees close for free.",
  alternates: { canonical: "/pricing" }
};

export default function PricingPage() {
  return <Pricing />;
}
