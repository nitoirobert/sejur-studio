import Link from "next/link";
import { CalendarDays, Check, ChevronRight, Heart, Star } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isoToDate } from "@/lib/dates/days";
import type { AccountUser } from "@/lib/account/server";
import { card, pill } from "@/components/ui/soft";

// Right column of the profile page: who you are, how complete the profile is, your activity
// (bookings, reviews, favorites) and the next stay. Every query is RLS-scoped to auth.uid().
export async function AccountOverview({ user }: { user: AccountUser }) {
  const supabase = await createClient();
  const [t, tNav, tStatus, tAuth, format, bookings, reviews, favorites] = await Promise.all([
    getTranslations("Account.overview"),
    getTranslations("Account.nav"),
    getTranslations("BookingStatus"),
    getTranslations("Auth.account"),
    getFormatter(),
    supabase.rpc("my_bookings", { p_limit: 50, p_offset: 0 }),
    supabase.from("reviews").select("id", { count: "exact", head: true }),
    supabase.from("favorites").select("unit_id", { count: "exact", head: true }),
  ]);

  const rows = bookings.data ?? [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date());
  const next = rows
    .filter((b) => b.check_out > today && (b.status === "confirmed" || b.status === "hold"))
    .sort((a, b) => a.check_in.localeCompare(b.check_in))[0];
  const day = (d: string) => format.dateTime(isoToDate(d), { day: "numeric", month: "short", timeZone: "UTC" });
  const nights = next ? Math.round((isoToDate(next.check_out).getTime() - isoToDate(next.check_in).getTime()) / 86_400_000) : 0;

  const steps = [
    { done: !!user.name, label: t("steps.name") },
    { done: !!user.phone, label: t("steps.phone") },
    { done: !!user.avatarUrl, label: t("steps.avatar") },
    { done: !user.pendingEmail && !!user.email, label: t("steps.email") },
  ];
  const percent = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
  const initial = (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase();

  const stats = [
    { href: "/cont/rezervari", icon: CalendarDays, label: tNav("bookings"), value: rows[0]?.total_count ?? 0 },
    { href: "/cont/recenzii", icon: Star, label: tNav("reviews"), value: reviews.count ?? 0 },
    { href: "/cont/favorite", icon: Heart, label: tNav("favorites"), value: favorites.count ?? 0 },
  ];

  return (
    <div className="grid content-start gap-5">
      {/* Cine ești + cât de complet e profilul */}
      <section className={`${card} p-5`}>
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-lg font-bold text-cream-50 shadow-pill">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external avatar URL (Supabase / Google)
              <img src={user.avatarUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              initial
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{user.name ?? user.email}</p>
            <p className="truncate text-xs text-ink-soft">
              {user.isHost ? tAuth("host") : tAuth("guest")}
              {user.createdAt && ` · ${t("memberSince", { date: format.dateTime(new Date(user.createdAt), { month: "long", year: "numeric" }) })}`}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-ink">{t("completeTitle")}</span>
            <span className="font-semibold text-accent">{percent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream-200 shadow-pressed">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          <ul className="mt-3 space-y-1.5">
            {steps.map((s) => (
              <li key={s.label} className={`flex items-center gap-2 text-xs ${s.done ? "text-ink-soft line-through decoration-ink-soft/40" : "text-ink"}`}>
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded-full ${s.done ? "bg-accent text-cream-50" : "ring-1 ring-sand"}`}
                >
                  {s.done && <Check className="size-3" strokeWidth={3} />}
                </span>
                {s.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Activitate */}
      <section className={`${card} p-5`}>
        <h2 className="font-serif text-lg text-ink">{t("activity")}</h2>
        <ul className="mt-3 grid grid-cols-3 gap-2.5">
          {stats.map(({ href, icon: Icon, label, value }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex flex-col items-start gap-1 rounded-2xl bg-cream-100 p-3 shadow-pressed transition-colors hover:bg-cream-200"
              >
                <Icon className="size-4 text-accent" />
                <span className="text-xl font-bold text-ink">{value}</span>
                <span className="truncate text-xs text-ink-soft">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Următorul sejur */}
      <section className={`${card} p-5`}>
        <h2 className="font-serif text-lg text-ink">{t("nextStay")}</h2>
        {next ? (
          <Link
            href={`/rezervare/${next.public_token}`}
            prefetch={false}
            className="group mt-3 flex items-center gap-3 rounded-2xl bg-cream-100 p-3 shadow-pressed transition-colors hover:bg-cream-200"
          >
            <span className="grid w-14 shrink-0 place-items-center rounded-xl bg-accent py-2 text-cream-50 shadow-accent">
              <span className="text-lg leading-none font-bold">{isoToDate(next.check_in).getUTCDate()}</span>
              <span className="mt-0.5 text-[10px] uppercase">
                {format.dateTime(isoToDate(next.check_in), { month: "short", timeZone: "UTC" })}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{next.property_name}</span>
              <span className="block truncate text-xs text-ink-soft">
                {next.unit_name}
                {next.city ? ` · ${next.city}` : ""}
              </span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                {day(next.check_in)} – {day(next.check_out)} · {t("nights", { count: nights })} · {tStatus(`status.${next.status}`)}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-ink-soft">{t("noStay")}</p>
            <Link href="/" className={`${pill} mt-3 px-4 py-2.5 text-sm`}>
              {t("search")}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
