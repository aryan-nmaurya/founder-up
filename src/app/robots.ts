import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private surfaces and anything that would waste crawl budget.
      disallow: [
        "/api/",
        "/admin",
        "/admin/",
        "/dashboard",
        "/settings/",
        "/onboarding",
        "/auth/",
        "/suspended",
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
