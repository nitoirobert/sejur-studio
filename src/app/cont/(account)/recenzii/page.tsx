import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { notDeployed, requireAccountUser } from "@/lib/account/server";
import { isoToDate } from "@/lib/dates/days";
import { card, pill } from "@/components/ui/soft";
import { accountSkeleton } from "@/components/account/AccountCards";
import { ReviewForm } from "@/components/account/ReviewForm";

// Reviews: finished confirmed stays still waiting for one, then the ones already written.
// Bookings come from my_bookings() (the caller's own), reviews from `reviews` (RLS: own rows).

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("reviews.title"), robots: { index: false } };
}

export default function ReviewsPage() {
  return (
    <>
      <Suspense fallback={accountSkeleton}>
        <Reviews />
      </Suspense>
    </>
  );
}

// Today in Romania, as YYYY-MM-DD (the date check-out is compared with).
function todayRo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date());
}

async function Reviews() {
  await requireAccountUser("/cont/recenzii");
  const supabase = await createClient();
  const [t, format] = await Promise.all([getTranslations("Account.reviews"), getFormatter()]);
  const [bookings, reviews] = await Promise.all([
    supabase.rpc("my_bookings", { p_limit: 100, p_offset: 0 }),
    supabase.from("reviews").select("id, booking_id, rating, comment, created_at").order("created_at", { ascending: false }),
  ]);
  if (notDeployed(reviews.error)) {
    return <p className={`${card} p-5 text-sm text-ink-soft`}>{t("soon")}</p>;
  }
  if (bookings.error || reviews.error) {
    return <p role="alert" className={`${card} p-5 text-sm text-ink-soft`}>{t("loadError")}</p>;
  }

  const today = todayRo();
  const byBooking = new Map((reviews.data ?? []).map((r) => [r.booking_id, r]));
  const finished = (bookings.data ?? []).filter((b) => b.status === "confirmed" && b.check_out <= today);
  const due = finished.filter((b) => !byBooking.has(b.booking_id));
  const done = finished.filter((b) => byBooking.has(b.booking_id));
  const day = (d: string) => format.dateTime(isoToDate(d), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  const stay = (b: (typeof finished)[number]) => (
    <div className="min-w-0">
      <p className="font-semibold text-ink">{b.property_name}</p>
      <p className="text-sm text-ink-soft">
        {b.unit_name}
        {b.city ? ` · ${b.city}` : ""} · {day(b.check_in)} – {day(b.check_out)}
      </p>
    </div>
  );

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-serif text-xl text-ink">{t("dueTitle")}</h2>
        {due.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">{t("dueEmpty")}</p>
        ) : (
          <ul className="mt-4 grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))]">
            {due.map((b) => (
              <li key={b.booking_id} className={`${card} space-y-4 p-5`}>
                {stay(b)}
                <ReviewForm bookingId={b.booking_id} unitId={b.unit_id} review={null} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-serif text-xl text-ink">{t("doneTitle")}</h2>
        {done.length === 0 ? (
          <div className="mt-3">
            <p className="text-sm text-ink-soft">{t("doneEmpty")}</p>
            {finished.length === 0 && (
              <Link href="/" className={`${pill} mt-4 px-4 py-2.5`}>
                {t("search")}
              </Link>
            )}
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))]">
            {done.map((b) => {
              const r = byBooking.get(b.booking_id)!;
              return (
                <li key={b.booking_id} className={`${card} space-y-4 p-5`}>
                  {stay(b)}
                  <ReviewForm bookingId={b.booking_id} unitId={b.unit_id} review={{ id: r.id, rating: r.rating, comment: r.comment }} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
