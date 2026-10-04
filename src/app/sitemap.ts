import type { MetadataRoute } from "next";
import { browsePages, filterBrowseListings } from "@/lib/browse-pages";
import { getPublishedOpportunities } from "@/lib/public-opportunities";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const listings = await getPublishedOpportunities();
  const now = new Date();

  return [
    { url: siteUrl.toString(), lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...browsePages
      .filter((page) => filterBrowseListings(page, listings).length > 0)
      .map((page) => ({
        url: new URL(`/internships/browse/${page.slug}`, siteUrl).toString(),
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
    {
      url: new URL("/toolkit", siteUrl).toString(),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...listings.map((listing) => ({
      url: new URL(`/internships/${listing.slug}`, siteUrl).toString(),
      lastModified: listing.last_verified_at ? new Date(listing.last_verified_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
