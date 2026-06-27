import type { Metadata, Viewport } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// Editorial "ledger" type system: a warm optical serif for display, a clean
// grotesque for body. Distinctive on purpose (not Inter/system).
const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  variable: "--font-display",
  display: "swap"
});
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap"
});
import { TopBar } from "../components/top-bar";
import { Footer } from "../components/footer";
import { SentryInit } from "../components/sentry-init";
import { AuthBootstrap } from "../components/auth-bootstrap";
import { LanguageProvider } from "../components/language-provider";
import { StructuredData } from "../components/structured-data";

const SITE_URL = "https://dailyclose.us";
const DESCRIPTION =
  "Close your store in 2 minutes. Owners see today's sales, missing cash, and missed closes across every location. Employees finish the daily close from any phone.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Daily Close: daily closing for retail",
    template: "%s · Daily Close"
  },
  description: DESCRIPTION,
  applicationName: "Daily Close",
  keywords: [
    "daily close software",
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
    title: "Daily Close: close your store in 2 minutes",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Daily Close",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Daily Close — close your store in 2 minutes" }],
    type: "website",
    locale: "en_US"
  },
  twitter: {
    card: "summary_large_image",
    title: "Daily Close: close your store in 2 minutes",
    description: DESCRIPTION,
    images: ["/og.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 }
  }
};

export const viewport: Viewport = {
  themeColor: "#1f7a4d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="flex min-h-screen flex-col overflow-x-hidden">
        <StructuredData />
        <LanguageProvider>
          <SentryInit />
          <AuthBootstrap />
          <TopBar />
          <div className="flex-1">{children}</div>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
