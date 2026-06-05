import type { Metadata } from "next";
import { Tutorials } from "../../components/marketing/tutorials";

export const metadata: Metadata = {
  title: "Tutorials",
  description:
    "Short training videos showing Daily Close on a real phone: get started, create a store, and download reports. Each one is under a minute.",
  alternates: { canonical: "/tutorials" }
};

export default function TutorialsPage() {
  return <Tutorials />;
}
