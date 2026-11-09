"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Bell, CalendarDays, CreditCard, Heart, LayoutDashboard, Star, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { hostDashboardUrl } from "@/lib/links";
import { pill, pillActive } from "@/components/ui/soft";

export const ACCOUNT_SECTIONS = [
  { key: "profile", href: "/cont", icon: UserRound },
  { key: "bookings", href: "/cont/rezervari", icon: CalendarDays },
  { key: "reviews", href: "/cont/recenzii", icon: Star },
  { key: "favorites", href: "/cont/favorite", icon: Heart },
  { key: "payments", href: "/cont/plati", icon: CreditCard },
  { key: "notifications", href: "/cont/notificari", icon: Bell },
] as const;

const railItem =
  "flex items-center gap-3.5 rounded-2xl px-3.5 py-3 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const railIdle = "text-ink-soft hover:bg-cream-100 hover:text-ink";
const railActive = "bg-accent text-cream-50 shadow-accent";
const railIcon = "size-6 shrink-0";
// The host panel link stands apart: gold, bold. Only host accounts see it.
const hostRail = "bg-star/15 font-bold text-ink ring-1 ring-star/60 hover:bg-star/25";
const hostPill = "inline-flex items-center gap-2 rounded-full bg-star/15 text-sm font-bold text-ink shadow-pill ring-1 ring-star/60";

/*
  Menu of the account pages. It lives in the (account) layout, so it stays mounted while you move
  between sections: no reload, no jump. The active entry comes from the URL.
  `isHost`: true / false once known; null while loading, when the host slot is reserved (invisible)
  so the vertically centred menu does not move when the answer arrives.
*/
export function AccountNav({ variant, isHost }: { variant: "rail" | "row"; isHost: boolean | null }) {
  const t = useTranslations("Account");
  const tHeader = useTranslations("Header");
  const path = usePathname();
  const active = ACCOUNT_SECTIONS.find((s) => (s.href === "/cont" ? path === "/cont" : path.startsWith(s.href)))?.key;

  if (variant === "row") {
    return (
      <nav aria-label={t("title")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {ACCOUNT_SECTIONS.map(({ key, href, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            aria-current={key === active ? "page" : undefined}
            className={`${key === active ? pillActive : pill} shrink-0 px-4 py-2.5`}
          >
            <Icon className="size-4" />
            {t(`nav.${key}`)}
          </Link>
        ))}
        {isHost && (
          <a href={hostDashboardUrl} className={`${hostPill} shrink-0 px-4 py-2.5`}>
            <LayoutDashboard className="size-4 text-star" />
            {tHeader("hostAccount")}
          </a>
        )}
      </nav>
    );
  }

  return (
    <nav aria-label={t("title")} className="flex w-60 flex-col gap-1 rounded-card bg-cream-50 p-3 shadow-soft">
      <Link href="/" className={`${railItem} ${railIdle}`}>
        <ArrowLeft className={railIcon} />
        {t("back")}
      </Link>
      <span className="mx-3 my-1.5 h-px bg-sand-200" aria-hidden />
      {ACCOUNT_SECTIONS.map(({ key, href, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === active ? "page" : undefined}
          className={`${railItem} ${key === active ? railActive : railIdle}`}
        >
          <Icon className={railIcon} />
          {t(`nav.${key}`)}
        </Link>
      ))}
      {isHost !== false && (
        <div className={isHost === null ? "invisible" : undefined} aria-hidden={isHost === null || undefined}>
          <span className="mx-3 my-1.5 block h-px bg-sand-200" aria-hidden />
          <a href={hostDashboardUrl} tabIndex={isHost ? undefined : -1} className={`${railItem} ${hostRail}`}>
            <LayoutDashboard className={`${railIcon} text-star`} />
            {tHeader("hostAccount")}
          </a>
        </div>
      )}
    </nav>
  );
}

/** Title of the current section, from the URL. */
export function AccountTitle() {
  const t = useTranslations("Account");
  const path = usePathname();
  const active = ACCOUNT_SECTIONS.find((s) => (s.href === "/cont" ? path === "/cont" : path.startsWith(s.href)))?.key ?? "profile";
  return <h1 className="font-serif text-3xl text-ink">{t(`nav.${active}`)}</h1>;
}
