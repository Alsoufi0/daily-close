"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/stores");
  }, [router]);
  return (
    <div className="p-8 text-center text-sm font-bold text-ink/55">Opening Stores…</div>
  );
}
