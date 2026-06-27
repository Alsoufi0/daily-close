import type { Metadata } from "next";

// /contact is a client component and can't export metadata itself, so this
// server layout supplies its SEO tags.
export const metadata: Metadata = {
  title: "Contact",
  description:
    "Questions about Daily Close, or want a quick demo? Reach the team and we'll help you close your stores faster.",
  alternates: { canonical: "/contact" }
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
