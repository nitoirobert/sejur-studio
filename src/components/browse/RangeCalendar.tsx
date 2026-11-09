"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { addDays, diffDays, weekday, type IsoDate } from "@/lib/dates/days";
import {
  holidayDaySet,
  upcomingHolidayStays,
  type HolidayStay,
} from "@/lib/dates/holidays";

/*
  Date range picker of the search bar (check-in / check-out).
  - Left (wide screens): upcoming Romanian holidays and popular dates as ready-made stays; one click
    selects the whole long weekend. On phones they are a scrolling row of chips above the month.
  - One month, Monday first; holiday days carry a small dot. Long weekends of the coming two years; more load as the list is scrolled.
  - Click = check-in, second click = check-out (a click before check-in starts over). Past days are off.
  - Footer: total nights, Cancel / Apply. Nothing changes in the search until Apply.
*/

type Props = {
  from: IsoDate;
  to: IsoDate;
  onApply: (from: IsoDate, to: IsoDate) => void;
  onCancel: () => void;
};

const todayRo = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(
    new Date(),
  );
const monthStart = (d: IsoDate) => `${d.slice(0, 7)}-01`;
const addMonths = (first: IsoDate, n: number) => {
  const y = Number(first.slice(0, 4));
  const m = Number(first.slice(5, 7)) - 1 + n;
  const date = new Date(Date.UTC(y, m, 1));
  return date.toISOString().slice(0, 10);
};
const utc = (d: IsoDate) => new Date(`${d}T00:00:00Z`);
const PAGE = 4; // holidays added each time the list is scrolled to its end

export function RangeCalendar({ from, to, onApply, onCancel }: Props) {
  const t = useTranslations("Calendar");
  const format = useFormatter();
  const [today] = useState(todayRo); // fixed while the picker is open
  const [draft, setDraft] = useState<{ from: IsoDate; to: IsoDate | null }>({
    from,
    to,
  });
  const [hover, setHover] = useState<IsoDate | null>(null);
  const [view, setView] = useState(() =>
    monthStart(from >= today ? from : today),
  );

  // The coming two years of long weekends, shown a few at a time: more load by themselves as the
  // list is scrolled. No scrollbar; instead a fade at the end, a bouncing arrow, and after 2 s a gentle
  // automatic "peek" (scroll a little, then back) so it is clear the list goes on.
  const allHolidays = useMemo(
    () => upcomingHolidayStays(today, 40, 730),
    [today],
  );
  const [shown, setShown] = useState(PAGE * 2);
  const holidays = allHolidays.slice(0, shown);
  const listRef = useRef<HTMLUListElement>(null);
  const peeking = useRef(false);
  const [touched, setTouched] = useState(false); // the user scrolled the list: no more hints
  const onListScroll = (e: React.UIEvent<HTMLUListElement>) => {
    const el = e.currentTarget;
    if (!peeking.current && (el.scrollTop > 4 || el.scrollLeft > 4))
      setTouched(true);
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48)
      setShown((n) => Math.min(n + PAGE, allHolidays.length));
  };
  useEffect(() => {
    const el = listRef.current;
    if (
      !el ||
      touched ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const vertical = el.scrollHeight > el.clientHeight + 4;
    if (!vertical && el.scrollWidth <= el.clientWidth + 4) return; // nothing to scroll
    const go = (to: number) =>
      el.scrollTo({ [vertical ? "top" : "left"]: to, behavior: "smooth" });
    let back: number | undefined;
    let done: number | undefined;
    const start = window.setTimeout(() => {
      peeking.current = true;
      go(72);
      back = window.setTimeout(() => go(0), 900);
      done = window.setTimeout(() => (peeking.current = false), 1800);
    }, 2000);
    return () =>
      [start, back, done].forEach((id) => id && window.clearTimeout(id));
  }, [touched]);
  // Working days worth taking off ("punte"), from the long weekends in the list: marked in the grid.
  const bridges = useMemo(
    () => new Set(allHolidays.flatMap((h) => h.leave)),
    [allHolidays],
  );
  const dots = useMemo(() => {
    const y = Number(view.slice(0, 4));
    return holidayDaySet([y, y + 1]);
  }, [view]);

  const end = draft.to ?? (hover && hover > draft.from ? hover : null);
  const canGoBack = view > monthStart(today);

  const pick = (d: IsoDate) => {
    if (d < today) return;
    if (draft.to || d <= draft.from) setDraft({ from: d, to: null });
    else setDraft({ from: draft.from, to: d });
  };

  const pickHoliday = (h: HolidayStay) => {
    setDraft({ from: h.from, to: h.to });
    setView(monthStart(h.from));
  };

  const short = (d: IsoDate) =>
    format.dateTime(utc(d), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  return (
    <div className="flex flex-col">
      <div className="flex flex-col md:flex-row">
        {/* Sărbători: coloană pe desktop, rând de butoane pe telefon */}
        <aside className="border-sand-200 md:w-44 md:shrink-0 md:border-r md:pr-2">
          <p className="mb-2 flex items-center gap-2.5 px-2 font-serif text-base leading-tight text-accent">
            <PartyPopper className="size-7 shrink-0 text-star" />
            <span>{t.rich("holidaysTitle", { br: () => <br /> })}</span>
          </p>
          <div className="relative">
            <ul
              ref={listRef}
              onScroll={onListScroll}
              onWheel={() => setTouched(true)}
              onTouchStart={() => setTouched(true)}
              className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 no-scrollbar max-md:[mask-image:linear-gradient(to_right,black_85%,transparent)] md:mx-0 md:max-h-64 md:flex-col md:gap-0.5 md:overflow-x-hidden md:overflow-y-auto md:px-0 md:pb-6 md:[mask-image:linear-gradient(to_bottom,black_78%,transparent)]"
            >
              {holidays.map((h) => {
                const active = draft.from === h.from && draft.to === h.to;
                return (
                  <li key={`${h.key}-${h.from}`} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => pickHoliday(h)}
                      aria-pressed={active}
                      className={`flex w-full flex-col rounded-xl px-2.5 py-1.5 text-left transition-colors max-md:rounded-full max-md:bg-cream-100 max-md:px-3.5 max-md:shadow-pressed ${
                        active
                          ? "bg-accent text-cream-50 max-md:bg-accent"
                          : "hover:bg-cream-100"
                      }`}
                    >
                      <span
                        className={`text-sm leading-tight font-semibold whitespace-nowrap md:whitespace-normal ${active ? "text-cream-50" : "text-ink"}`}
                      >
                        {t(`holidays.${h.key}`)}
                      </span>
                      <span
                        className={`text-xs whitespace-nowrap ${active ? "text-cream-50/80" : "text-ink-soft"}`}
                      >
                        {short(h.from)} – {short(h.to)} ·{" "}
                        {t("nights", { count: h.nights })}
                      </span>
                      {h.leave.length > 0 && (
                        <span
                          className={`mt-0.5 text-[11px] font-bold whitespace-nowrap ${active ? "text-cream-50" : "text-star"}`}
                          title={t("leaveDays", {
                            days: h.leave.map(short).join(", "),
                          })}
                        >
                          {t("leave", { count: h.leave.length })}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {!touched && (
              <ChevronDown
                aria-hidden
                className="pointer-events-none absolute bottom-0 left-1/2 hidden size-4 -translate-x-1/2 animate-bounce text-accent md:block"
              />
            )}
          </div>
        </aside>

        {/* Lunile */}
        <div
          className="relative flex-1 md:pl-3"
          onMouseLeave={() => setHover(null)}
        >
          <button
            type="button"
            onClick={() => setView(addMonths(view, -1))}
            disabled={!canGoBack}
            aria-label={t("prevMonth")}
            className="absolute top-0 left-0 grid size-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-cream-100 hover:text-ink disabled:opacity-30 md:left-3"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setView(addMonths(view, 1))}
            aria-label={t("nextMonth")}
            className="absolute top-0 right-0 grid size-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-cream-100 hover:text-ink"
          >
            <ChevronRight className="size-4" />
          </button>
          <Month
            first={view}
            className=""
            today={today}
            from={draft.from}
            end={end}
            dots={dots}
            bridges={bridges}
            bridgeLabel={t("bridge")}
            holidayName={(k) => t(`holidays.${k}`)}
            onPick={pick}
            onHover={setHover}
          />
        </div>
      </div>

      {/* Subsol: acțiuni */}
      <div className="mt-3 flex items-center gap-3 border-t border-sand-200 pt-3">
        <span className="min-w-0 flex-1 text-center font-serif text-xl text-ink">
          {draft.to ? (
            t("nights", { count: diffDays(draft.from, draft.to) })
          ) : (
            <span className="font-sans text-sm text-muted">
              {t("pickCheckOut")}
            </span>
          )}
        </span>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-cream-50 px-4 py-2 text-sm font-semibold text-ink shadow-pill ring-1 ring-sand transition-colors hover:bg-cream-100"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            disabled={!draft.to}
            onClick={() => draft.to && onApply(draft.from, draft.to)}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-cream-50 shadow-accent transition-colors hover:bg-accent-600 disabled:opacity-50"
          >
            {t("apply")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Month({
  first,
  className,
  today,
  from,
  end,
  dots,
  bridges,
  bridgeLabel,
  holidayName,
  onPick,
  onHover,
}: {
  first: IsoDate;
  className: string;
  today: IsoDate;
  from: IsoDate;
  end: IsoDate | null;
  dots: Map<IsoDate, string>;
  bridges: Set<IsoDate>;
  bridgeLabel: string;
  holidayName: (key: string) => string;
  onPick: (d: IsoDate) => void;
  onHover: (d: IsoDate | null) => void;
}) {
  const format = useFormatter();
  const lead = (weekday(first) + 6) % 7; // Monday first
  const month = first.slice(0, 7);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i - lead));
  const rows =
    cells[35].slice(0, 7) === month
      ? 6
      : cells[28].slice(0, 7) === month
        ? 5
        : 4;
  const weekdays = cells
    .slice(0, 7)
    .map((d) =>
      format
        .dateTime(utc(d), { weekday: "short", timeZone: "UTC" })
        .replace(".", ""),
    );

  return (
    <div className={className}>
      <p className="mb-2 text-center text-sm leading-8 font-semibold text-ink capitalize">
        {format.dateTime(utc(first), {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })}
      </p>
      <div role="grid" className="grid grid-cols-7 gap-y-1 text-center">
        {weekdays.map((w, i) => (
          <span
            key={i}
            className="pb-1 text-xs font-medium text-muted capitalize"
          >
            {w}
          </span>
        ))}
        {cells.slice(0, rows * 7).map((d) => {
          const inMonth = d.slice(0, 7) === month;
          if (!inMonth) return <span key={d} aria-hidden />;
          const past = d < today;
          const isFrom = d === from;
          const isEnd = d === end;
          const inside = !!end && d > from && d < end;
          const holiday = dots.get(d);
          const bridge = bridges.has(d);
          const edge = isFrom || isEnd;
          return (
            <span
              key={d}
              className={`relative flex justify-center ${inside ? "bg-accent-50" : ""} ${
                isFrom && end
                  ? "bg-gradient-to-r from-transparent from-50% to-accent-50 to-50%"
                  : ""
              } ${isEnd ? "bg-gradient-to-l from-transparent from-50% to-accent-50 to-50%" : ""}`}
            >
              <button
                type="button"
                disabled={past}
                onClick={() => onPick(d)}
                onMouseEnter={() => onHover(d)}
                aria-pressed={edge}
                aria-label={
                  format.dateTime(utc(d), {
                    dateStyle: "full",
                    timeZone: "UTC",
                  }) +
                  (holiday ? ` · ${holidayName(holiday)}` : "") +
                  (bridge ? ` · ${bridgeLabel}` : "")
                }
                title={
                  holiday
                    ? holidayName(holiday)
                    : bridge
                      ? bridgeLabel
                      : undefined
                }
                className={`relative grid size-8 place-items-center rounded-lg text-sm tabular-nums transition-colors ${
                  edge
                    ? "bg-accent font-bold text-cream-50 shadow-accent"
                    : past
                      ? "cursor-default text-muted/50"
                      : inside
                        ? "font-semibold text-ink hover:bg-accent/15"
                        : "text-ink hover:bg-cream-100"
                } ${d === today && !edge ? "ring-1 ring-accent/50" : ""} ${bridge && !edge ? "outline-1 -outline-offset-2 outline-star outline-dashed" : ""}`}
              >
                {Number(d.slice(8))}
                {holiday && (
                  <span
                    aria-hidden
                    className={`absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full ${edge ? "bg-cream-50" : "bg-star"}`}
                  />
                )}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
