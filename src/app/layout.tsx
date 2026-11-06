import type { Metadata } from "next";
import Script from "next/script";
import { DM_Serif_Display, Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { SceneBackground } from "@/components/SceneBackground";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

// latin-ext e necesar pentru diacriticele românești (ă, â, î, ș, ț)
const serif = DM_Serif_Display({
  variable: "--font-dm-serif",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

// Fontul „de brand": folosit pentru „Sejur Studio" și „Unități disponibile" (aceeași înfățișare pe ambele)
const brand = Fraunces({
  variable: "--font-fraunces",
  weight: ["600", "700"],
  subsets: ["latin", "latin-ext"],
});

const sans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Meta");
  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      suppressHydrationWarning // clasa „dark" e pusă de script înainte de React
      className={`${serif.variable} ${sans.variable} ${brand.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        {/* aplică tema salvată înainte de prima afișare (fără „clipire") */}
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <SceneBackground />
        {/* Face traducerile disponibile și în componentele client */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
