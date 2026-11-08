import type { MetadataRoute } from "next";
import { units } from "@/lib/mock-units";
import { SITE_URL } from "@/lib/site";

// sitemap.xml: lista paginilor publice, ca Google să le găsească pe toate.
// Când cazările vor veni din Supabase, lista se generează din baza de date.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    ...units.map((u) => ({
      url: `${SITE_URL}/cazare/${u.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      images: u.photos.slice(0, 3),
    })),
  ];
}
