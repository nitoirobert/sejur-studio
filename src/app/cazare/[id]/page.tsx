import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { units } from "@/lib/mock-units";
import { PropertyView } from "@/components/property/PropertyView";
import { JsonLd } from "@/components/seo/JsonLd";
import { unitJsonLd } from "@/lib/seo/structured-data";
import { SITE_NAME } from "@/lib/site";

// Pagina dedicată unei cazări: /cazare/<id>. Cu ?foto=<n> se deschide direct galeria pe tot ecranul,
// la poza n (așa ajunge clientul când dă click pe o poză din panoul din dreapta).

export function generateStaticParams() {
  return units.map((u) => ({ id: u.id }));
}

export async function generateMetadata({ params }: PageProps<"/cazare/[id]">): Promise<Metadata> {
  const { id } = await params;
  const unit = units.find((u) => u.id === id);
  if (!unit) {
    const t = await getTranslations("Property");
    return { title: t("notFound") };
  }
  const [tMeta, tUnit] = await Promise.all([getTranslations("Meta"), getTranslations("UnitText")]);
  // Titlu cu cuvintele căutate: „Căsuța din Brazi – cazare în Bran, Brașov – Sejur Studio"
  const title = tMeta("unitTitle", { name: tUnit(`${id}.name`), place: unit.location });
  const description = tUnit(`${id}.description`);
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
      images: unit.photos.slice(0, 1).map((src) => ({ url: `${src}?w=1200&h=630&fit=crop&q=75`, width: 1200, height: 630 })),
    },
  };
}

// Pagina e statică (o variantă per cazare, din generateStaticParams). ?foto=n se citește în browser.
// Citirea lui `params` stă sub <Suspense>, cum cere Next 16 pentru navigări instantanee:
// la navigare se vede imediat scheletul, apoi pagina (deja pre-generată).
export default function CazarePage({ params }: PageProps<"/cazare/[id]">) {
  return (
    <Suspense fallback={<PropertySkeleton />}>
      <Cazare params={params} />
    </Suspense>
  );
}

async function Cazare({ params }: { params: PageProps<"/cazare/[id]">["params"] }) {
  const { id } = await params;
  const unit = units.find((u) => u.id === id);
  if (!unit) notFound();
  return (
    <>
      <JsonLd data={unitJsonLd(unit)} />
      <PropertyView unit={unit} />
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
