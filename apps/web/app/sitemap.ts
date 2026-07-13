import type { MetadataRoute } from "next";

const BASE = "https://dailyclose.us";

// Public, indexable routes only. Authed app routes (/owner, /admin, /close,
// /billing, /account, /setup) and the bare /login are intentionally excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: Array<{ path: string; priority: number }> = [
    { path: "", priority: 1.0 },
    { path: "/how-it-works", priority: 0.8 },
    { path: "/tutorials", priority: 0.8 },
    { path: "/pricing", priority: 0.8 },
    { path: "/partners", priority: 0.7 },
    { path: "/signup", priority: 0.7 },
    { path: "/contact", priority: 0.6 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 }
  ];
  return routes.map(({ path, priority }) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority
  }));
}
