import type { Metadata } from "next";
import { Pricing } from "../../components/marketing/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple per-store pricing from $29/month — the rate per store drops as you grow. 14-day free trial, no setup fee, cancel anytime. Employees close for free.",
  alternates: { canonical: "/pricing" }
};

export default function PricingPage() {
  return <Pricing />;
}
