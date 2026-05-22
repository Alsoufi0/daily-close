import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TopBar } from "../components/top-bar";
import { Footer } from "../components/footer";

export const metadata: Metadata = {
  title: "SmokeShop Daily Close",
  description: "Close your store in 2 minutes and know your real profit every day.",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#1f7a4d",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <TopBar />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
