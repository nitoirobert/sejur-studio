import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { PhotosPanel } from "@/components/dashboard/photos/PhotosPanel";
import { PricesPanel } from "@/components/dashboard/prices/PricesPanel";
import { DetailsForm } from "@/components/dashboard/property/DetailsForm";
import { PropertyTabs, parseTab } from "@/components/dashboard/property/Tabs";
import { UnitsPanel } from "@/components/dashboard/property/UnitsPanel";
import {
  bucharestToday,
  loadPhotos,
  loadPriceRules,
  loadProperty,
  loadUnits,
  type PropertyDetails,
} from "@/components/dashboard/property/data";
import { requireViewer } from "@/lib/supabase/dal";
import { panel } from "@/components/dashboard/property/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard.pages.properties");
  return { title: t("title") };
}

// The dashboard nav reads usePathname() outside Suspense (dashboard/layout.tsx, not this brief's file);
// under a dynamic [id] that is runtime data, so this segment blocks on the server instead of prerendering.
// The HTTP 404 for a full page load comes from src/proxy.ts (the streamed shell keeps a 200 here);
// the notFound() calls below render the not-found UI for client navigations, which skip that check.
export const instant = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = PageProps<"/dashboard/proprietati/[id]">;

// URL state: ?tab=detalii|unitati|poze|preturi and, on Prețuri, ?unitate=<uuid>.
export default async function PropertyPage({ params, searchParams }: Props) {
  const [{ id }, t] = await Promise.all([params, getTranslations("Dashboard.pages.properties")]);
  if (!UUID_RE.test(id)) notFound();
  // Session first (anon goes to /login, not to a 404), then the property under RLS: another
  // organization's id and a missing id get the same not-found UI.
  await requireViewer();
  const property = await loadProperty(id);
  if (!property) notFound();
  return (
    <DashboardPage title={t("title")} subtitle={t("subtitle")} fallback={<DetailSkeleton />}>
      <Property property={property} searchParams={searchParams} />
    </DashboardPage>
  );
}

async function Property({ property, searchParams }: { property: PropertyDetails } & Pick<Props, "searchParams">) {
  const [sp, t] = await Promise.all([searchParams, getTranslations("Dashboard.properties")]);
  const tab = parseTab(sp.tab);

  return (
    <div data-testid="property-detail" data-property-id={property.id} data-tab={tab}>
      <div className="mb-4 flex flex-col gap-3 md:mb-5">
        <Link
          href="/dashboard/proprietati"
          data-testid="property-back"
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 data-testid="property-name" className="min-w-0 font-serif text-3xl leading-tight text-balance break-words text-ink md:text-4xl">
            {property.name}
          </h2>
          <span
            data-testid="property-status"
            data-status={property.status}
            className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold ${
              property.status === "activa"
                ? "bg-accent text-cream-50 dark:bg-accent-strong dark:text-[#0d1626]"
                : "border border-glass-line bg-cream-50/80 text-ink-soft"
            }`}
          >
            {t(`status.${property.status}`)}
          </span>
        </div>
      </div>
      <PropertyTabs propertyId={property.id} active={tab} />
      <div className="mt-4 md:mt-5">
        {tab === "detalii" && <DetailsForm property={property} />}
        {tab === "unitati" && <UnitsTab propertyId={property.id} />}
        {tab === "poze" && <PhotosTab propertyId={property.id} />}
        {tab === "preturi" && <PricesTab propertyId={property.id} unitParam={sp.unitate} />}
      </div>
    </div>
  );
}

async function UnitsTab({ propertyId }: { propertyId: string }) {
  const units = await loadUnits(propertyId);
  return <UnitsPanel propertyId={propertyId} units={units} />;
}

async function PhotosTab({ propertyId }: { propertyId: string }) {
  const [photos, units] = await Promise.all([loadPhotos(propertyId), loadUnits(propertyId)]);
  return <PhotosPanel propertyId={propertyId} photos={photos} units={units.map((u) => ({ id: u.id, name: u.name }))} />;
}

async function PricesTab({ propertyId, unitParam }: { propertyId: string; unitParam: string | string[] | undefined }) {
  const [units, today] = await Promise.all([loadUnits(propertyId), bucharestToday()]);
  const wanted = Array.isArray(unitParam) ? unitParam[0] : unitParam;
  const unit = units.find((u) => u.id === wanted) ?? units[0] ?? null;
  const rules = unit ? await loadPriceRules(unit.id) : [];
  return (
    <PricesPanel
      propertyId={propertyId}
      units={units.map((u) => ({ id: u.id, name: u.name }))}
      unitId={unit?.id ?? null}
      rules={rules}
      today={today}
    />
  );
}

function DetailSkeleton() {
  return (
    <div aria-hidden data-testid="property-skeleton">
      <div className="mb-5 h-10 w-64 rounded-full bg-cream-100/60" />
      <div className="mb-5 h-[3.25rem] w-full max-w-md rounded-full bg-cream-100/60" />
      <div className={`${panel} h-96`} />
    </div>
  );
}
