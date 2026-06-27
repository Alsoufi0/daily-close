// Site-wide JSON-LD structured data (server component, rendered in the root
// layout). Helps Google understand the brand, the website, and the product so
// it can show richer results. Keep claims factual — no invented ratings.

const SITE_URL = "https://dailyclose.us";

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Daily Close",
  url: SITE_URL,
  logo: `${SITE_URL}/apple-touch-icon.png`,
  description:
    "Daily Close helps retail store owners and their staff close out the register at the end of every day.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: `${SITE_URL}/contact`
  }
};

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Daily Close",
  url: SITE_URL,
  publisher: { "@type": "Organization", name: "Daily Close" }
};

// Per-store subscription, graduated from $29 (1 store) down to $14 (16+).
const softwareApplication = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Daily Close",
  applicationCategory: "BusinessApplication",
  operatingSystem: "iOS, Android, Web",
  url: SITE_URL,
  description:
    "Close your store in 2 minutes. Snap the POS report, count the cash, done. Owners see today's sales, missing cash, and missed closes across every location.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "14",
    highPrice: "29",
    offerCount: "4",
    description: "Per-store monthly subscription with a 14-day free trial."
  }
};

export function StructuredData() {
  const blocks = [organization, website, softwareApplication];
  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          // Static, trusted content — safe to inline.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
