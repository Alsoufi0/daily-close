import type { Metadata } from "next";

// /signup is a client component; this server layout supplies its SEO tags.
export const metadata: Metadata = {
  title: "Start your free trial",
  description:
    "Create your Daily Close account and start a 14-day free trial. Set up your first store and close it from any phone in minutes.",
  alternates: { canonical: "/signup" }
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
