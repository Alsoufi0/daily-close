import type { Metadata } from "next";
import { Partners } from "../../components/marketing/partners";

export const metadata: Metadata = {
  title: "Partner Program",
  description:
    "Refer retailers to Daily Close and earn recurring commission — 25% in year one, 15% in year two, plus volume bonuses. Apply to become a partner.",
  alternates: { canonical: "/partners" }
};

// FAQ rich-result data mirroring the program terms shown on the page.
const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    [
      "How much do Daily Close partners earn?",
      "Partners earn 25% of each referred store's monthly subscription in year one, 15% in year two, plus one-time volume bonuses of $100, $300, and $750 at 10, 25, and 50 active stores."
    ],
    [
      "How are referrals tracked?",
      "Each partner gets a unique QR code and referral link. The first scan wins, and the store is tracked to that partner for the life of the account."
    ],
    [
      "When are commissions paid?",
      "Commission is paid every month a referred store keeps its subscription, and only on subscription fees that are actually collected."
    ],
    [
      "How do I become a partner?",
      "Apply on the Partner Program page. We review each application and email you your referral code."
    ]
  ].map(([q, a]) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a }
  }))
};

export default function PartnersPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Partners />
    </>
  );
}
