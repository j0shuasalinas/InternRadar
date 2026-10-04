import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api",
        "/auth",
        "/sign-in",
        "/sign-up",
        "/forgot-password",
        "/reset-password",
        "/onboarding",
        "/dashboard",
        "/discover",
        "/applications",
        "/settings",
        "/admin",
        "/demo",
        "/unsubscribe",
        "/api/calendar",
      ],
    },
    sitemap: new URL("/sitemap.xml", getSiteUrl()).toString(),
  };
}
