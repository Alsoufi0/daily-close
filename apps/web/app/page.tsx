import type { Metadata } from "next";
import { MarketingHome } from "../components/marketing/marketing-home";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// `/` is the public marketing landing. Sign-in lives at /login (linked from the
// top bar). MarketingHome is a client component (uses the i18n t() hook + the
// session, to swap the CTA to "Go to dashboard" for signed-in visitors); this
// server page keeps the route crawlable and inherits the SEO metadata defined
// in app/layout.tsx.
export default function HomePage() {
  return <MarketingHome />;
}
