import type { MetadataRoute } from "next";

// Allow crawling of the marketing/funnel pages; keep the authed app + bare
// login out of the index (no SEO value, and they redirect/gate anyway).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/owner", "/admin", "/close", "/billing", "/account", "/setup", "/login", "/demo"]
    },
    sitemap: "https://dailyclose.us/sitemap.xml"
  };
}
