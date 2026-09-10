import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";
import { getAllUsernames } from "@/lib/db";

/** Plan §40 - founder profiles are the strongest organic surface. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    { path: "", priority: 1, changeFrequency: "hourly" as const },
    { path: "/about", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/pricing", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/search", priority: 0.5, changeFrequency: "weekly" as const },
    { path: "/contact", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/terms", priority: 0.2, changeFrequency: "yearly" as const },
    { path: "/privacy", priority: 0.2, changeFrequency: "yearly" as const },
    { path: "/refunds", priority: 0.2, changeFrequency: "yearly" as const },
    { path: "/shipping", priority: 0.2, changeFrequency: "yearly" as const },
  ].map((route) => ({
    url: `${APP_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  let founders: MetadataRoute.Sitemap = [];
  try {
    const rows = await getAllUsernames();
    founders = rows.map((row) => ({
      url: `${APP_URL}/${row.username}`,
      lastModified: new Date(row.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch (error) {
    console.error("[sitemap] could not list founders:", error);
  }

  return [...staticRoutes, ...founders];
}
