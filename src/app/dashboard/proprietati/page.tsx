import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, House, ImageOff, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { CreateProperty } from "@/components/dashboard/property/CreateProperty";
import { PAGE_SIZE, loadPropertyList, type PropertyCard } from "@/components/dashboard/property/data";
import { panel } from "@/components/dashboard/property/ui";
import { pill } from "@/components/ui/soft";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard.pages.properties");
  return { title: t("title") };
}

// URL state: ?pagina=N (24 per page, paginated on the server).
export default async function PropertiesPage({ searchParams }: PageProps<"/dashboard/proprietati">) {
  const t = await getTranslations("Dashboard.pages.properties");
  return (
    <DashboardPage title={t("title")} subtitle={t("subtitle")} fallback={<ListSkeleton />}>
      <PropertyList searchParams={searchParams} />
    </DashboardPage>
  );
}

function pageParam(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

async function PropertyList({ searchParams }: { searchParams: PageProps<"/dashboard/proprietati">["searchParams"] }) {
  const page = pageParam((await searchParams).pagina);
  const [{ items, total }, t] = await Promise.all([loadPropertyList(page), getTranslations("Dashboard.properties")]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (total === 0) {
    return (
      <section data-testid="property-empty" className={`${panel} flex flex-col items-start gap-5 p-6 sm:p-9 md:flex-row md:items-center md:gap-8`}>
        <span className="grid size-20 shrink-0 place-items-center rounded-[1.6rem] bg-cream-50/80 text-accent shadow-pill md:size-24">
          <House className="size-9 md:size-10" strokeWidth={1.6} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-serif text-2xl leading-tight text-balance text-ink md:text-[1.75rem]">{t("list.emptyTitle")}</h2>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-pretty text-ink-soft">{t("list.emptyBody")}</p>
          <div className="mt-5">
            <CreateProperty variant="inline" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <div data-testid="property-list">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 md:mb-5">
        <p data-testid="property-count" className="rounded-full border border-glass-line bg-veil px-4 py-2 text-sm font-semibold text-ink backdrop-blur-md">
          {t("list.count", { count: total })}
        </p>
        <CreateProperty />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-3">
        {items.map((p) => (
          <li key={p.id}>
            <Card property={p} t={t} />
          </li>
        ))}
      </ul>
      {pages > 1 && <Pagination page={page} pages={pages} t={t} />}
    </div>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"Dashboard.properties">>>;

function Card({ property: p, t }: { property: PropertyCard; t: T }) {
  const hidden = p.status === "ascunsa";
  return (
    <Link
      href={`/dashboard/proprietati/${p.id}`}
      data-testid="property-card"
      data-property-id={p.id}
      data-status={p.status}
      className={`${panel} group flex h-full flex-col overflow-hidden p-2 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.35rem] bg-cream-100/80">
        {p.coverUrl ? (
          // Signed URL from a private bucket: next/image would need the Supabase host in next.config.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.coverUrl}
            alt={p.coverAlt ?? ""}
            data-testid="property-card-cover"
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <div data-testid="property-card-nocover" className="grid size-full place-items-center text-ink-soft">
            <span className="flex flex-col items-center gap-2 text-sm">
              <ImageOff className="size-7" strokeWidth={1.5} aria-hidden />
              {t("list.noCover")}
            </span>
          </div>
        )}
        <span
          data-testid="property-card-status"
          className={`absolute top-3 left-3 inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold shadow-sm backdrop-blur-md ${
            hidden ? "bg-cream-50/90 text-ink-soft" : "bg-accent text-cream-50 dark:bg-accent-strong dark:text-[#0d1626]"
          }`}
        >
          {t(`status.${p.status}`)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3 pt-3 pb-2">
        <h2 data-testid="property-card-name" className="truncate font-serif text-xl leading-tight text-ink">
          {p.name}
        </h2>
        <p className="flex min-w-0 items-center gap-1.5 text-[14px] text-ink-soft">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{p.city || t("list.noCity")}</span>
          <span aria-hidden>·</span>
          <span data-testid="property-card-units" className="shrink-0 tabular-nums">
            {t("list.units", { count: p.units })}
          </span>
        </p>
      </div>
    </Link>
  );
}

function Pagination({ page, pages, t }: { page: number; pages: number; t: T }) {
  const href = (n: number) => (n === 1 ? "/dashboard/proprietati" : `/dashboard/proprietati?pagina=${n}`);
  const link = `${pill} h-11 px-4`;
  return (
    <nav aria-label={t("list.pagination")} data-testid="property-pagination" className="mt-6 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} className={link} aria-label={t("list.prev")}>
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      ) : (
        <span className={`${link} opacity-40`} aria-hidden>
          <ChevronLeft className="size-4" />
        </span>
      )}
      <span className="text-sm font-medium text-ink-soft tabular-nums">{t("list.page", { page, pages })}</span>
      {page < pages ? (
        <Link href={href(page + 1)} className={link} aria-label={t("list.next")}>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span className={`${link} opacity-40`} aria-hidden>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden data-testid="property-skeleton">
      <div className="mb-5 flex justify-between">
        <div className="h-10 w-32 rounded-full bg-cream-100/60" />
        <div className="h-12 w-48 rounded-full bg-cream-100/60" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${panel} h-72`} />
        ))}
      </div>
    </div>
  );
}
