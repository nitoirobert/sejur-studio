import type { MetadataRoute } from "next";
import { getPublishedUnits } from "@/lib/catalog/server";
import { SITE_URL } from "@/lib/site";

// sitemap.xml: lista paginilor publice, ca Google să le găsească pe toate.
// Unitățile publicate vin din baza de date la fiecare cerere. Fără poze: URL-urile semnate expiră.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const units = await getPublishedUnits();
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    ...units.map((u) => ({
      url: `${SITE_URL}/cazare/${u.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
