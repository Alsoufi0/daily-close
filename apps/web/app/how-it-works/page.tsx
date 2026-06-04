import type { Metadata } from "next";
import { HowItWorks } from "../../components/marketing/how-it-works";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "From sign-up to your first close tonight: create your account, add a store, invite your team, and review every close from one dashboard.",
  alternates: { canonical: "/how-it-works" }
};

export default function HowItWorksPage() {
  return <HowItWorks />;
}
