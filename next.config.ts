import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Plugin-ul next-intl găsește automat configurația din src/i18n/request.ts
const withNextIntl = createNextIntlPlugin();

// Pozele cazărilor vin din Supabase Storage prin URL-uri semnate (bucket privat „photos")
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const storagePattern = supabaseUrl ? [new URL("/storage/v1/object/sign/**", supabaseUrl)] : [];

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
    // Poze de test de pe Unsplash, până avem upload propriu (Supabase Storage)
    remotePatterns: [new URL("https://images.unsplash.com/**"), ...storagePattern],
  },
};

export default withNextIntl(nextConfig);
