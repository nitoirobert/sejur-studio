import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// robots.txt: motoarele de căutare indexează site-ul public, nu panoul gazdelor și paginile de cont.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/login", "/cont-nou", "/cont/", "/auth/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
