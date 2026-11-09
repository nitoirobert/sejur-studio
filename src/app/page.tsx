import type { Metadata } from "next";
import { Suspense } from "react";
import { PropertyBrowser } from "@/components/browse/PropertyBrowser";
import { JsonLd } from "@/components/seo/JsonLd";
import { homeJsonLd } from "@/lib/seo/structured-data";
import { getPublishedUnits } from "@/lib/catalog/server";
import { UnitsProvider } from "@/lib/use-units";

// Adresa canonică: pagina de start (parametrii din adresă, ex. ?cazare=, nu fac pagini noi)
export const metadata: Metadata = { alternates: { canonical: "/" } };

// Pagina publică: unitățile publicate, citite din baza de date la fiecare cerere.
// Antetul e în PropertyBrowser, fiindcă arată sejurul ales (date + oaspeți).
export default function Home() {
  return (
    <div className="flex w-full flex-col px-4 lg:h-dvh lg:px-6 2xl:px-8">
      <JsonLd data={homeJsonLd()} />
      <Suspense fallback={<HomeSkeleton />}>
        <Catalog />
      </Suspense>
    </div>
  );
}

async function Catalog() {
  const units = await getPublishedUnits();
  return (
    <UnitsProvider units={units}>
      <PropertyBrowser />
    </UnitsProvider>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6 pt-28 lg:pt-44" aria-hidden>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="aspect-[4/5] animate-pulse rounded-card bg-cream-100/70" />
        ))}
      </div>
    </div>
  );
}
