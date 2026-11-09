import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Plugin-ul next-intl găsește automat configurația din src/i18n/request.ts
const withNextIntl = createNextIntlPlugin();

// Pozele cazărilor vin din Supabase Storage prin URL-uri semnate (bucket privat „photos")
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Obiect (nu URL): un URL are search="" și ar refuza `?token=...` din URL-urile semnate
const storagePattern = supabaseUrl
  ? [{ protocol: "https" as const, hostname: new URL(supabaseUrl).hostname, pathname: "/storage/v1/object/sign/**" }]
  : [];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Pagina de stare a rezervării (/rezervare/<token>): linkul e secret, deci nu-l trimitem mai
  // departe (Referer), nu-l indexăm și nu-l păstrăm în cache.
  async headers() {
    return [
      {
        source: "/rezervare/:token*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
  images: {
    // Optimized photos stay cached for 31 days (signed urls are stable for days, see src/lib/catalog/sign.ts)
    minimumCacheTTL: 60 * 60 * 24 * 31,
    formats: ["image/avif", "image/webp"],
    // Poze de test de pe Unsplash, până avem upload propriu (Supabase Storage)
    remotePatterns: [new URL("https://images.unsplash.com/**"), ...storagePattern],
  },
};

export default withNextIntl(nextConfig);
