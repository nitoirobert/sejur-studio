import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { card, pill } from "@/components/ui/soft";
import { isoToDate } from "@/lib/dates/days";

// "My bookings" for any signed-in account (guest or host): my_bookings() returns only the
// requests linked to auth.uid(). Without an account: the login page, back here afterwards.

const PAGE_SIZE = 20;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("bookingsTitle"), robots: { index: false } };
}

export default function MyBookingsPage({ searchParams }: PageProps<"/cont/rezervari">) {
  return (
    <>
      <Suspense fallback={<div className={`${card} h-48 animate-pulse`} aria-hidden />}>
        <Bookings searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const STATUS_STYLE: Record<string, string> = {
  hold: "bg-star text-ink",
  confirmed: "bg-accent text-cream-50",
  cancelled: "bg-cream-200 text-ink",
  expired: "bg-cream-200 text-ink",
};

async function Bookings({ searchParams }: { searchParams: PageProps<"/cont/rezervari">["searchParams"] }) {
  const sp = await searchParams;
  const raw = Number(Array.isArray(sp.pagina) ? sp.pagina[0] : sp.pagina);
  const page = Number.isInteger(raw) && raw >= 1 && raw <= 1000 ? raw : 1;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent("/cont/rezervari")}`);

  const [t, tStatus, format] = await Promise.all([
    getTranslations("Account"),
    getTranslations("BookingStatus"),
    getFormatter(),
  ]);
  const { data, error } = await supabase.rpc("my_bookings", { p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE });
  if (error) {
    return (
      <p role="alert" className={`${card} p-5 text-sm text-ink-soft`}>
        {t("loadError")}
      </p>
    );
  }
  const rows = data ?? [];
  const total = rows[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (rows.length === 0) {
    return (
      <div className={`${card} p-6 text-center`}>
        <p className="text-sm text-ink-soft">{page > 1 ? t("pageEmpty") : t("bookingsEmpty")}</p>
        <Link href="/" className={`${pill} mt-4 px-4 py-2.5`}>
          {t("search")}
        </Link>
      </div>
    );
  }

  const day = (d: string) => format.dateTime(isoToDate(d), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  // Today in Romania: a stay whose check-out has passed is "past".
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date());
  const upcoming = rows.filter((b) => b.check_out > today);
  const past = rows.filter((b) => b.check_out <= today);

  const list = (items: typeof rows) => (
    <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))]">
      {items.map((b) => {
        const status = b.status in STATUS_STYLE ? b.status : "cancelled";
        const reviewable = b.status === "confirmed" && b.check_out <= today;
        return (
          <li key={b.booking_id} className={`${card} p-5`} data-testid="my-booking">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{b.property_name}</p>
                <p className="text-sm text-ink-soft">
                  {b.unit_name}
                  {b.city ? ` · ${b.city}` : ""}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold shadow-pill ${STATUS_STYLE[status]}`}>
                {tStatus(`status.${status}`)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-ink">
                {day(b.check_in)} – {day(b.check_out)}
              </span>
              <span className="font-semibold text-ink">
                {tStatus("amount", {
                  amount: format.number(b.total_amount / 100, { maximumFractionDigits: 2 }),
                  currency: b.currency,
                })}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
              <Link
                href={`/rezervare/${b.public_token}`}
                prefetch={false}
                className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
              >
                {t("viewStatus")}
              </Link>
              {reviewable && (
                <Link href="/cont/recenzii" className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
                  {t("reviews.leave")}
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <div className="space-y-8">
        {upcoming.length > 0 && (
          <section>
            <h2 className="mb-4 font-serif text-xl text-ink">{t("upcoming")}</h2>
            {list(upcoming)}
          </section>
        )}
        {past.length > 0 && (
          <section>
            <h2 className="mb-4 font-serif text-xl text-ink">{t("past")}</h2>
            {list(past)}
          </section>
        )}
      </div>
      {pages > 1 && (
        <nav aria-label={t("pager")} className="mt-6 flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link href={`/cont/rezervari?pagina=${page - 1}`} className={`${pill} px-3 py-2`} aria-label={t("prev")}>
              <ChevronLeft className="size-4" />
            </Link>
          )}
          <span className="text-ink-soft">{t("page", { page, pages })}</span>
          {page < pages && (
            <Link href={`/cont/rezervari?pagina=${page + 1}`} className={`${pill} px-3 py-2`} aria-label={t("next")}>
              <ChevronRight className="size-4" />
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
