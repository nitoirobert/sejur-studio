import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Plugin-ul next-intl găsește automat configurația din src/i18n/request.ts
const withNextIntl = createNextIntlPlugin();

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
  images: {
    // Poze de test de pe Unsplash, până avem upload propriu (Supabase Storage)
    remotePatterns: [new URL("https://images.unsplash.com/**")],
  },
};

export default withNextIntl(nextConfig);
