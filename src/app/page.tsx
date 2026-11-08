import type { Metadata } from "next";
import { PropertyBrowser } from "@/components/browse/PropertyBrowser";
import { JsonLd } from "@/components/seo/JsonLd";
import { homeJsonLd } from "@/lib/seo/structured-data";

// Adresa canonică: pagina de start (parametrii din adresă, ex. ?cazare=, nu fac pagini noi)
export const metadata: Metadata = { alternates: { canonical: "/" } };

// Pagina publică a unei proprietăți (deocamdată cu date de test).
// Antetul e în PropertyBrowser, fiindcă arată sejurul ales (date + oaspeți).
export default function Home() {
  return (
    <div className="flex w-full flex-col px-4 lg:h-dvh lg:px-6 2xl:px-8">
      <JsonLd data={homeJsonLd()} />
      <PropertyBrowser />
    </div>
  );
}
