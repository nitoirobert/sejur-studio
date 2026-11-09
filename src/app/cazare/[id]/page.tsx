import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getBookingContext, getPublishedUnit } from "@/lib/catalog/server";
import { PropertyView } from "@/components/property/PropertyView";
import { JsonLd } from "@/components/seo/JsonLd";
import { unitJsonLd } from "@/lib/seo/structured-data";
import { SITE_NAME } from "@/lib/site";

// Pagina dedicată unei cazări: /cazare/<id>. Cu ?foto=<n> se deschide direct galeria pe tot ecranul,
// la poza n (așa ajunge clientul când dă click pe o poză din panoul din dreapta).

export async function generateMetadata({ params }: PageProps<"/cazare/[id]">): Promise<Metadata> {
  const { id } = await params;
  const unit = await getPublishedUnit(id);
  if (!unit) {
    const t = await getTranslations("Property");
    return { title: t("notFound"), robots: { index: false } };
  }
  const [tMeta, tUnit] = await Promise.all([getTranslations("Meta"), getTranslations("UnitText")]);
  const name = tUnit.has(`${unit.id}.name`) ? tUnit(`${unit.id}.name`) : unit.name;
  const description = tUnit.has(`${unit.id}.description`) ? tUnit(`${unit.id}.description`) : unit.description;
  // Titlu cu cuvintele căutate: „Căsuța din Brazi – cazare în Bran, Brașov – Sejur Studio"
  const title = unit.location ? tMeta("unitTitle", { name, place: unit.location }) : name;
  const url = `/cazare/${id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // openGraph se scrie complet aici: Next nu îl combină cu cel din layout
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: `${title} – ${SITE_NAME}`,
      description,
      url,
      images: unit.hasPhotos ? unit.photos.slice(0, 1).map((src) => ({ url: src })) : undefined,
    },
  };
}

// Pagina se randează la fiecare cerere (unitățile vin din baza de date; o unitate publicată acum
// se vede imediat). ?foto=n se citește în browser. Citirea datelor stă sub <Suspense>:
// la navigare se vede imediat scheletul, apoi pagina.
export default function CazarePage({ params }: PageProps<"/cazare/[id]">) {
  return (
    <Suspense fallback={<PropertySkeleton />}>
      <Cazare params={params} />
    </Suspense>
  );
}

async function Cazare({ params }: { params: PageProps<"/cazare/[id]">["params"] }) {
  const { id } = await params;
  const unit = await getPublishedUnit(id);
  if (!unit) notFound();
  const booking = await getBookingContext(unit.id);
  return (
    <>
      <JsonLd data={unitJsonLd(unit)} />
      <PropertyView unit={unit} booking={booking} />
    </>
  );
}

function PropertySkeleton() {
  return (
    <div className="flex w-full flex-col px-4 lg:px-6 2xl:px-8" aria-hidden>
      <div className="h-[5.5rem]" />
      <div className="h-[42vh] min-h-72 animate-pulse rounded-inner bg-cream-100/70 lg:h-[60vh]" />
    </div>
  );
}
