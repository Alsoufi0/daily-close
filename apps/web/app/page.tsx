"use client";

import { useEffect } from "react";
import { ProductionLogin } from "../components/production-login";

export default function HomePage() {
  useEffect(() => {
    const token = window.localStorage.getItem("smokeshop-token");
    if (token) window.location.replace("/owner");
  }, []);
  return <ProductionLogin />;
}
