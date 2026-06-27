import type { Metadata } from "next";

// /login is a client component; this server layout supplies its SEO tags.
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Daily Close to close your store or review today's sales across every location.",
  alternates: { canonical: "/login" }
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
