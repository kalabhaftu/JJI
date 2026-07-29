import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.justjournalit.site";
  let normalizedSiteUrl = rawSiteUrl.startsWith("http") ? rawSiteUrl : `https://${rawSiteUrl}`;
  normalizedSiteUrl = normalizedSiteUrl.replace(/\/$/, "");

  const publicRoutes = [
    "",
    "/about",
    "/changelog",
    "/contact",
    "/cookies",
    "/docs",
    "/feedback",
    "/login",
    "/privacy",
    "/terms",
  ];

  return publicRoutes.map((route) => ({
    url: `${normalizedSiteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
