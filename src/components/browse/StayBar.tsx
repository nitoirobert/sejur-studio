"use client";

import { Baby, CalendarDays, History, MapPin, Search, User, X } from "lucide-react";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import { primaryButton } from "@/components/ui/soft";
import { popover } from "@/components/ui/motion";
import { units } from "@/lib/mock-units";
import { matchScore, sitePlaces, suggestUnits, typewriterWords } from "@/lib/search/catalog";
import { clearRecent, rankRecent, recordRecent, useRecent } from "@/lib/search/recent";
import { nightsBetween } from "./UnitPanel";
import { GuestsEditor, useGuestsSummary } from "./GuestsEditor";
import { totalPeople } from "@/lib/guests";
import { typeIcons } from "./icons";
import { Autocomplete, type AcGroup } from "./Autocomplete";
import { useDismiss } from "./use-dismiss";
import { useTypewriter } from "./use-typewriter";
import type { Stay } from "./PropertyBrowser";

type Open = "dates" | "guests" | null;

type Props = {
  stay: Stay;
  onStayChange: (s: Stay) => void;
  query: string;
  onQueryChange: (q: string) => void;
  onOpenUnit: (id: string) => void;
  className?: string;
};

// Bara de căutare: [perioadă] | [🔍 nume sau locație] | [oaspeți]
export function StayBar({ stay, onStayChange, query, onQueryChange, onOpenUnit, className = "" }: Props) {
  const t = useTranslations("Toolbar");
  const tSearch = useTranslations("Search");
  const tBooking = useTranslations("Booking");
  const tDetail = useTranslations("Detail");
  const format = useFormatter();
  const summary = useGuestsSummary();
  const [open, setOpen] = useState<Open>(null);
  const [focused, setFocused] = useState(false);
  const [now, setNow] = useState(0); // momentul deschiderii – pentru ordonarea căutărilor recente
  const ref = useRef<HTMLDivElement>(null);
  const recent = useRecent("search");
  const typed = useTypewriter(typewriterWords, focused || query.length > 0);

  useDismiss(ref, open !== null, () => setOpen(null));

  const commit = (q: string) => {
    onQueryChange(q);
    recordRecent("search", q);
  };

  // Sugestiile din căutare, grupate
  const groups: AcGroup[] = [];
  if (!query.trim()) {
    groups.push({
      id: "recent",
      title: tSearch("recent"),
      action: { label: tSearch("clearHistory"), onClick: () => clearRecent("search") },
      items: rankRecent(recent, now).map((r) => ({
        id: `r-${r.q}`,
        label: r.q,
        icon: History,
        onPick: () => commit(r.q),
      })),
    });
    groups.push({
      id: "popular",
      title: tSearch("popular"),
      items: [
        ...sitePlaces.map((p) => ({
          id: `p-${p.label}`,
          label: p.city,
          sublabel: p.county,
          meta: tSearch("unitsCount", { count: p.count }),
          icon: MapPin,
          onPick: () => commit(p.city),
        })),
        ...[...units]
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 3)
          .map((u) => ({
            id: `u-${u.id}`,
            label: u.name,
            sublabel: u.location,
            icon: typeIcons[u.type],
            onPick: () => {
              commit(u.name);
              onOpenUnit(u.id);
            },
          })),
      ],
    });
  } else {
    groups.push({
      id: "recent",
      title: tSearch("recent"),
      items: rankRecent(recent, now, 20)
        .filter((r) => matchScore(r.q, query) > 0 && r.q !== query)
        .slice(0, 3)
        .map((r) => ({ id: `r-${r.q}`, label: r.q, icon: History, onPick: () => commit(r.q) })),
    });
    groups.push({
      id: "units",
      title: tSearch("units"),
      items: suggestUnits(query, recent, now).map((u) => ({
        id: `u-${u.id}`,
        label: u.name,
        sublabel: u.location,
        icon: typeIcons[u.type],
        onPick: () => {
          commit(u.name);
          onOpenUnit(u.id);
        },
      })),
    });
    groups.push({
      id: "places",
      title: tSearch("places"),
      items: sitePlaces
        .filter((p) => matchScore(p.label, query) > 0)
        .map((p) => ({
          id: `p-${p.label}`,
          label: p.city,
          sublabel: p.county,
          meta: tSearch("unitsCount", { count: p.count }),
          icon: MapPin,
          onPick: () => commit(p.city),
        })),
    });
  }

  const completions = [
    ...recent.map((r) => r.q),
    ...units.map((u) => u.name),
    ...sitePlaces.map((p) => p.city),
  ];

  const dateOpts = { day: "numeric", month: "short" } as const;
  const nights = nightsBetween(stay.from, stay.to);
  const segment =
    "relative flex shrink-0 items-center gap-2 text-sm font-semibold text-ink transition-colors hover:bg-cream-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
  const field =
    "mt-1 w-full rounded-2xl bg-cream-100 px-4 py-3 text-sm font-semibold text-ink shadow-pressed outline-none [color-scheme:light] focus-visible:ring-2 focus-visible:ring-accent/60";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <motion.div
        layout
        className={`flex h-12 items-stretch rounded-full bg-cream-50 shadow-pill transition-shadow 2xl:h-14 ${
          focused ? "ring-2 ring-accent/25" : ""
        }`}
      >
        <button
          type="button"
          aria-expanded={open === "dates"}
          onClick={() => setOpen(open === "dates" ? null : "dates")}
          className={`${segment} rounded-l-full pr-4 pl-4 2xl:pr-5 2xl:pl-6 ${open === "dates" ? "bg-cream-100" : ""}`}
        >
          <CalendarDays className="size-4 shrink-0 text-accent 2xl:size-5" />
          <span className="whitespace-nowrap">
            {t("dates", {
              from: format.dateTime(new Date(stay.from), dateOpts),
              to: format.dateTime(new Date(stay.to), dateOpts),
            })}
          </span>
        </button>

        <span className="my-3 w-px bg-sand-200" aria-hidden />

        <Autocomplete
          className="min-w-0 flex-1"
          fieldClassName="flex h-full items-center gap-2 px-4"
          listClassName="left-1/2 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2"
          value={query}
          onChange={onQueryChange}
          onSubmit={() => recordRecent("search", query)}
          onFocus={() => {
            setFocused(true);
            setNow(Date.now());
            setOpen(null);
          }}
          onBlur={() => {
            setFocused(false);
            recordRecent("search", query);
          }}
          groups={groups}
          completions={completions}
          ariaLabel={t("search")}
          focusedPlaceholder={t("searchPlaceholder")}
          hint={tSearch("hint")}
          placeholder={
            typed === null ? (
              <span className="truncate text-muted">{t("searchPlaceholder")}</span>
            ) : (
              <span className="truncate text-muted">
                {tSearch("typePrefix")}
                <span className="font-medium text-ink-soft">{typed}</span>
                <span className="ml-0.5 inline-block h-4 w-[1.5px] translate-y-[3px] animate-pulse bg-accent" />
              </span>
            )
          }
          leading={<Search className="size-4 shrink-0 text-ink-soft 2xl:size-5" />}
          trailing={
            <AnimatePresence>
              {query && (
                <motion.button
                  type="button"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  onClick={() => onQueryChange("")}
                  aria-label={t("clearSearch")}
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-cream-100 text-ink-soft hover:text-ink"
                >
                  <X className="size-3.5" />
                </motion.button>
              )}
            </AnimatePresence>
          }
        />

        <span className="my-3 w-px bg-sand-200" aria-hidden />

        <button
          type="button"
          aria-expanded={open === "guests"}
          aria-label={`${t("guestsAria", { count: totalPeople(stay) })}: ${summary(stay)}`}
          onClick={() => setOpen(open === "guests" ? null : "guests")}
          className={`${segment} rounded-r-full pr-4 pl-4 2xl:pr-6 2xl:pl-5 ${open === "guests" ? "bg-cream-100" : ""}`}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={stay.guests}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              className="text-base tabular-nums"
            >
              {stay.guests}
            </motion.span>
          </AnimatePresence>
          <User className="size-5 text-accent" strokeWidth={2} />
          {stay.kids + stay.infants > 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 border-l border-sand-200 pl-2.5"
            >
              <span className="text-base tabular-nums">{stay.kids + stay.infants}</span>
              <Baby className="size-5 text-accent" strokeWidth={2} />
            </motion.span>
          )}
        </button>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            key={open}
            role="dialog"
            variants={popover}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: open === "dates" ? "top left" : "top right" }}
            className={`absolute top-full z-40 mt-3 w-80 max-w-[calc(100vw-2rem)] rounded-card bg-cream-50 p-5 shadow-soft ring-1 ring-sand ${
              open === "dates" ? "left-0" : "right-0"
            }`}
          >
            {open === "dates" ? (
              <div className="space-y-4">
                <label className="block text-xs font-semibold text-ink">
                  {tBooking("checkIn")}
                  <input
                    type="date"
                    value={stay.from}
                    onChange={(e) => onStayChange({ ...stay, from: e.target.value })}
                    className={field}
                  />
                </label>
                <label className="block text-xs font-semibold text-ink">
                  {tBooking("checkOut")}
                  <input
                    type="date"
                    value={stay.to}
                    min={stay.from}
                    onChange={(e) => onStayChange({ ...stay, to: e.target.value })}
                    className={field}
                  />
                </label>
                <p className={`text-sm ${nights > 0 ? "text-ink-soft" : "text-red-700"}`}>
                  {nights > 0 ? tDetail("booking.nights", { count: nights }) : tBooking("invalidDates")}
                </p>
              </div>
            ) : (
              <GuestsEditor value={stay} onChange={(g) => onStayChange({ ...stay, ...g })} />
            )}
            <button
              type="button"
              onClick={() => setOpen(null)}
              className={`${primaryButton} mt-5 w-full !py-3 text-sm`}
            >
              {t("done")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
