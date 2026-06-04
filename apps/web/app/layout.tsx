import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TopBar } from "../components/top-bar";
import { Footer } from "../components/footer";
import { SentryInit } from "../components/sentry-init";
import { AuthBootstrap } from "../components/auth-bootstrap";
import { LanguageProvider } from "../components/language-provider";

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
    title: "Daily Close",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Daily Close",
    images: [{ url: "/apple-touch-icon.png", width: 1024, height: 1024 }],
    type: "website",
    locale: "en_US"
  },
  twitter: {
    card: "summary",
    title: "Daily Close",
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
