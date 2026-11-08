import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { units } from "@/lib/mock-units";
import { PropertyView } from "@/components/property/PropertyView";

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
  const tMeta = await getTranslations("Meta");
  const tUnit = await getTranslations("UnitText");
  return { title: `${tUnit(`${id}.name`)} – ${tMeta("title")}`, description: tUnit(`${id}.description`) };
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
  return <PropertyView unit={unit} />;
}

function PropertySkeleton() {
  return (
    <div className="flex w-full flex-col px-4 lg:px-6 2xl:px-8" aria-hidden>
      <div className="h-[5.5rem]" />
      <div className="h-[42vh] min-h-72 animate-pulse rounded-inner bg-cream-100/70 lg:h-[60vh]" />
    </div>
  );
}
