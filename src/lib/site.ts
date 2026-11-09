// Adresa publică a site-ului: pentru linkuri absolute în SEO (canonical, sitemap, Open Graph, JSON-LD).
// Pe Vercel se setează NEXT_PUBLIC_SITE_URL când avem domeniul propriu (ex. https://sejurstudio.ro).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://sejur-studio.vercel.app").replace(/\/$/, "");
export const SITE_NAME = "Sejur Studio";
