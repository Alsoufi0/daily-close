import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TopBar } from "../components/top-bar";
import { Footer } from "../components/footer";
import { SentryInit } from "../components/sentry-init";

const SITE_URL = "https://follow-th-pbelow-exaclty-smokeshop.vercel.app";
const DESCRIPTION =
  "Close your store in 2 minutes. Owners see today's sales, missing cash, and missed closes across every location. Employees finish the daily close from any phone.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SmokeShop Daily Close — Daily closing for smoke shops",
    template: "%s · SmokeShop Daily Close"
  },
  description: DESCRIPTION,
  applicationName: "SmokeShop Daily Close",
  keywords: [
    "smoke shop software",
    "daily close",
    "POS close-out",
    "cash reconciliation",
    "multi-store management"
  ],
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png"
  },
  openGraph: {
    title: "SmokeShop Daily Close",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "SmokeShop Daily Close",
    images: [{ url: "/apple-touch-icon.png", width: 1024, height: 1024 }],
    type: "website",
    locale: "en_US"
  },
  twitter: {
    card: "summary",
    title: "SmokeShop Daily Close",
    description: DESCRIPTION,
    images: ["/apple-touch-icon.png"]
  },
  robots: { index: true, follow: true }
};

export const viewport: Viewport = {
  themeColor: "#1f7a4d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col overflow-x-hidden">
        <SentryInit />
        <TopBar />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
