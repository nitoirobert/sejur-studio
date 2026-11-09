import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Home } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { anonClient } from "@/lib/catalog/anon";
import { card, pill } from "@/components/ui/soft";
import { isoToDate } from "@/lib/dates/days";

/*
  Status of a booking request, reached through its secret link (public_token).
  - Shows only the stay: no guest name, email or phone.
  - The token is not in the title and the page sends no referrer, is never indexed or cached
    (headers in next.config.ts, plus the metadata below).
  - A wrong or malformed token gets the same "not found" page as an unknown one (zero rows).
*/

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("BookingStatus");
  return { title: t("title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default function BookingStatusPage({ params }: PageProps<"/rezervare/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col px-4 py-6 lg:py-10">
      <Link href="/" className={`${pill} self-start px-4 py-2.5`}>
        <ArrowLeft className="size-4" />
        <BackLabel />
      </Link>
      <Suspense fallback={<div className={`${card} mt-6 h-72 animate-pulse`} aria-hidden />}>
        <Status params={params} />
      </Suspense>
    </main>
  );
}

async function BackLabel() {
  const t = await getTranslations("BookingStatus");
  return <>{t("back")}</>;
}

const STATUS_STYLE: Record<string, string> = {
  hold: "bg-star text-ink",
  confirmed: "bg-accent text-cream-50",
  cancelled: "bg-cream-200 text-ink",
  expired: "bg-cream-200 text-ink",
};

async function Status({ params }: { params: PageProps<"/rezervare/[token]">["params"] }) {
  const { token } = await params;
  const [t, format] = await Promise.all([getTranslations("BookingStatus"), getFormatter()]);
  const { data } = await anonClient().rpc("public_booking_status", { p_token: token.slice(0, 64) });
  const b = data?.[0];

  if (!b) {
    return (
      <section className={`${card} mt-6 p-6 text-center`} aria-labelledby="status-title">
        <h1 id="status-title" className="font-serif text-2xl text-ink">
          {t("notFoundTitle")}
        </h1>
        <p className="mt-3 text-sm text-ink-soft">{t("notFoundBody")}</p>
        <Link href="/" className={`${pill} mt-6 px-4 py-2.5`}>
          <Home className="size-4" />
          {t("home")}
        </Link>
      </section>
    );
  }

  const known = ["hold", "confirmed", "cancelled", "expired"].includes(b.status);
  const status = known ? b.status : "cancelled";
  const day = (d: string) =>
    format.dateTime(isoToDate(d), { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const total = format.number(b.total_amount / 100, { maximumFractionDigits: 2 });

  return (
    <section className={`${card} mt-6 p-6`} aria-labelledby="status-title">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t("eyebrow")}</p>
      <h1 id="status-title" className="mt-1 font-serif text-2xl text-ink">
        {b.unit_name}
      </h1>
      <p className="text-sm text-ink-soft">{b.property_name}</p>

      <p
        className={`mt-4 inline-flex rounded-full px-3 py-1 text-sm font-semibold shadow-pill ${STATUS_STYLE[status]}`}
        data-testid="booking-status"
      >
        {t(`status.${status}`)}
      </p>
      <p className="mt-3 text-sm text-ink-soft">{t(`explain.${status}`)}</p>

      <dl className="mt-6 space-y-3 border-t border-sand pt-4 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt className="flex items-center gap-2 text-muted">
            <CalendarDays className="size-4 text-accent" aria-hidden />
            {t("checkIn")}
          </dt>
          <dd className="text-right font-medium text-ink">{day(b.check_in)}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="flex items-center gap-2 text-muted">
            <CalendarDays className="size-4 text-accent" aria-hidden />
            {t("checkOut")}
          </dt>
          <dd className="text-right font-medium text-ink">{day(b.check_out)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-sand pt-3 font-bold text-ink">
          <dt>{t("total")}</dt>
          <dd>{t("amount", { amount: total, currency: b.currency })}</dd>
        </div>
      </dl>

      <p className="mt-6 rounded-2xl bg-cream-100 px-4 py-3 text-xs text-ink-soft">{t("keepLink")}</p>
    </section>
  );
}
