"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BedDouble, CalendarSync, ChevronDown, House } from "lucide-react";
import { addDays, diffDays, isWeekend, type IsoDate } from "@/lib/dates/days";
import { fmt } from "./format";
import { barKind, type BookingSource, type ChartBooking, type ChartProperty, type ChartUnit } from "./types";

export type Selection = { unitId: string; checkIn: IsoDate; checkOut: IsoDate };
type Drag = { unitId: string; anchor: number; head: number; min: number; max: number };

// Minimum column width per view: below it the chart scrolls sideways inside its own box.
const MIN_COL: Record<number, number> = { 7: 44, 14: 40, 30: 34 };

/*
  Units x days. The unit column is sticky; the day grid scrolls horizontally inside the chart only.
  A bar covers its nights: it starts on the check-in column and ends where the check-out column begins.
  Mouse or pen: drag over free days of one unit (it stops at the first occupied day). Touch: tap a free day.
*/
export function ChartGrid({
  days,
  today,
  properties,
  bookingsByUnit,
  onSelect,
  onOpen,
}: {
  days: IsoDate[];
  today: IsoDate;
  properties: ChartProperty[];
  bookingsByUnit: Map<string, ChartBooking[]>;
  onSelect: (s: Selection) => void;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("Dashboard.chart");
  const n = days.length;
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const minWidth = `calc(var(--unit-col) + ${n * (MIN_COL[n] ?? 34)}px)`;

  // A fade on the right edge while there is more chart to scroll to.
  const scroller = useRef<HTMLDivElement>(null);
  const [moreRight, setMoreRight] = useState(false);
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const more = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setMoreRight((prev) => (prev === more ? prev : more));
  }, []);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure, n]);

  const update = useCallback((next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const begin = useCallback(
    (unitId: string, idx: number, occupied: boolean[]) => {
      // The free run around idx: the selection can never cross a booked night.
      let min = idx;
      while (min > 0 && !occupied[min - 1]) min--;
      let max = idx;
      while (max < occupied.length - 1 && !occupied[max + 1]) max++;
      update({ unitId, anchor: idx, head: idx, min, max });
    },
    [update],
  );

  const move = useCallback(
    (idx: number) => {
      const d = dragRef.current;
      if (!d) return;
      const head = Math.min(d.max, Math.max(d.min, idx));
      if (head !== d.head) update({ ...d, head });
    },
    [update],
  );

  const finish = useCallback(
    (commit: boolean) => {
      const d = dragRef.current;
      update(null);
      if (!d || !commit) return;
      const a = Math.min(d.anchor, d.head);
      const b = Math.max(d.anchor, d.head);
      onSelect({ unitId: d.unitId, checkIn: days[a], checkOut: addDays(days[b], 1) });
    },
    [days, onSelect, update],
  );

  const tap = useCallback(
    (unitId: string, idx: number) => onSelect({ unitId, checkIn: days[idx], checkOut: addDays(days[idx], 1) }),
    [days, onSelect],
  );

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="relative [--unit-col:7.5rem] md:[--unit-col:12rem] xl:[--unit-col:14.5rem]">
    <div
      ref={scroller}
      data-testid="chart-scroll"
      onScroll={measure}
      className="relative overflow-x-auto overscroll-x-contain"
    >
      <div role="table" data-testid="chart-grid" data-days={n} className="relative" style={{ minWidth }}>
        {/* Day header */}
        <div role="row" className="grid grid-cols-[var(--unit-col)_1fr] border-b border-glass-line">
          <div
            role="columnheader"
            className="sticky left-0 z-20 flex items-end bg-cream-50 px-3 pb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase md:px-4"
          >
            {t("unit")}
          </div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {days.map((d) => {
              const isToday = d === today;
              return (
                <div
                  key={d}
                  role="columnheader"
                  data-testid="chart-day"
                  data-date={d}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={fmt.long(d)}
                  className={`flex flex-col items-center gap-0.5 py-2 text-center leading-none ${
                    isWeekend(d) ? "bg-sand/45" : ""
                  }`}
                >
                  <span className={`text-[11px] ${isToday ? "font-semibold text-accent" : "text-ink-soft"}`}>
                    {fmt.weekday(d)}
                  </span>
                  <span
                    className={`grid size-7 place-items-center rounded-full text-sm tabular-nums ${
                      isToday ? "bg-accent font-semibold text-cream-50" : "text-ink"
                    }`}
                  >
                    {fmt.day(d)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {properties.map((p) => {
          const closed = collapsed.has(p.id);
          return (
            <div key={p.id} role="rowgroup" data-testid="chart-property" data-property={p.id}>
              <div role="row" className="grid grid-cols-[var(--unit-col)_1fr] border-b border-glass-line bg-cream-100/50">
                <div role="rowheader" className="sticky left-0 z-20 bg-cream-100">
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-expanded={!closed}
                    aria-label={t(closed ? "expand" : "collapse", { name: p.name })}
                    className="flex min-h-11 w-full items-center gap-1.5 px-2 text-left text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:px-3"
                  >
                    <ChevronDown
                      aria-hidden
                      className={`size-4 shrink-0 text-ink-soft transition-transform duration-150 ${closed ? "-rotate-90" : ""}`}
                    />
                    <span className="line-clamp-2 text-[13px] leading-tight break-words md:text-sm">{p.name}</span>
                  </button>
                </div>
                <div className="flex items-center px-3 text-xs text-ink-soft">{t("units", { count: p.units.length })}</div>
              </div>
              {!closed &&
                p.units.map((u) => (
                  <UnitRow
                    key={u.id}
                    unit={u}
                    days={days}
                    today={today}
                    bookings={bookingsByUnit.get(u.id) ?? EMPTY}
                    drag={drag?.unitId === u.id ? drag : null}
                    onBegin={begin}
                    onMove={move}
                    onFinish={finish}
                    onTap={tap}
                    onOpen={onOpen}
                  />
                ))}
            </div>
          );
        })}

      </div>
    </div>
      <div
        aria-hidden
        data-testid="chart-fade"
        data-visible={moreRight ? "" : undefined}
        className={`pointer-events-none absolute inset-y-0 right-0 z-30 w-10 bg-linear-to-l from-cream-50 to-transparent transition-opacity duration-200 ${
          moreRight ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

const EMPTY: ChartBooking[] = [];

type RowProps = {
  unit: ChartUnit;
  days: IsoDate[];
  today: IsoDate;
  bookings: ChartBooking[];
  drag: Drag | null;
  onBegin: (unitId: string, idx: number, occupied: boolean[]) => void;
  onMove: (idx: number) => void;
  onFinish: (commit: boolean) => void;
  onTap: (unitId: string, idx: number) => void;
  onOpen: (id: string) => void;
};

// Memoized: while dragging only the dragged row re-renders.
const UnitRow = memo(function UnitRow({ unit, days, today, bookings, drag, onBegin, onMove, onFinish, onTap, onOpen }: RowProps) {
  const t = useTranslations("Dashboard.chart");
  const n = days.length;
  const from = days[0];
  const track = useRef<HTMLDivElement>(null);
  const tapStart = useRef<{ x: number; y: number } | null>(null);
  const todayIdx = diffDays(from, today);

  // Nights in view taken by a booking (hold included: an active hold blocks).
  const occupied = new Array<boolean>(n).fill(false);
  const bars = bookings.flatMap((b) => {
    const start = Math.max(diffDays(from, b.checkIn), 0);
    const end = Math.min(diffDays(from, b.checkOut), n);
    if (end <= start) return [];
    for (let i = start; i < end; i++) occupied[i] = true;
    return [{ b, start, end, clipStart: b.checkIn < from, clipEnd: diffDays(from, b.checkOut) > n }];
  });

  const indexAt = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect();
    return Math.min(n - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * n)));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-testid=chart-bar]")) return;
    const idx = indexAt(e.clientX);
    if (occupied[idx]) return;
    if (e.pointerType === "touch") {
      tapStart.current = { x: e.clientX, y: e.clientY };
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onBegin(unit.id, idx, occupied);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") {
      const s = tapStart.current;
      tapStart.current = null;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 10) {
        const idx = indexAt(e.clientX);
        if (!occupied[idx]) onTap(unit.id, idx);
      }
      return;
    }
    if (drag) onFinish(true);
  };

  const sel = drag ? { a: Math.min(drag.anchor, drag.head), b: Math.max(drag.anchor, drag.head) } : null;

  return (
    <div role="row" data-testid="chart-row" data-unit-id={unit.id} className="grid grid-cols-[var(--unit-col)_1fr] border-b border-glass-line/70">
      <div
        role="rowheader"
        className="sticky left-0 z-20 flex min-h-12 items-center bg-cream-50 px-3 text-[13px] leading-tight text-ink md:px-4 md:text-sm"
        title={unit.name}
      >
        <span className="line-clamp-2 break-words">{unit.name}</span>
      </div>
      <div
        ref={track}
        role="cell"
        className="relative h-12 cursor-cell touch-pan-x touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerMove={drag ? (e) => onMove(indexAt(e.clientX)) : undefined}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          tapStart.current = null;
          if (drag) onFinish(false);
        }}
        onLostPointerCapture={() => drag && onFinish(false)}
      >
        <div aria-hidden className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {days.map((d, i) => (
            <div
              key={d}
              data-testid="chart-cell"
              data-unit-id={unit.id}
              data-date={d}
              data-free={occupied[i] ? undefined : ""}
              className={`border-l border-glass-line/50 ${isWeekend(d) ? "bg-sand/35" : ""} ${
                d === today ? "bg-accent/6" : ""
              } ${occupied[i] ? "" : "hover:bg-accent/8"}`}
            />
          ))}
        </div>

        {todayIdx >= 0 && todayIdx < n && (
          <div
            aria-hidden
            data-testid="chart-today-line"
            data-date={today}
            className="pointer-events-none absolute inset-y-0 z-[1] w-0.5 -translate-x-1/2 bg-accent/60"
            style={{ left: `${((todayIdx + 0.5) / n) * 100}%` }}
          />
        )}

        {sel && (
          <div
            aria-hidden
            data-testid="chart-selection"
            className="pointer-events-none absolute inset-y-1 rounded-lg border-2 border-dashed border-accent bg-accent/12"
            style={{ left: `${(sel.a / n) * 100}%`, width: `${((sel.b - sel.a + 1) / n) * 100}%` }}
          />
        )}

        {bars.map(({ b, start, end, clipStart, clipEnd }) => (
          <Bar key={b.id} booking={b} from={days[start]} to={addDays(from, end)} start={start} end={end} n={n} clipStart={clipStart} clipEnd={clipEnd} onOpen={onOpen} t={t} />
        ))}
      </div>
    </div>
  );
});

const SOURCE_ICON: Record<BookingSource, typeof House | null> = {
  direct: null,
  booking: BedDouble,
  airbnb: House,
  altul: CalendarSync,
};

function Bar({
  booking: b,
  from,
  to,
  start,
  end,
  n,
  clipStart,
  clipEnd,
  onOpen,
  t,
}: {
  booking: ChartBooking;
  /** First shown night and the day after the last shown night (clipped to the window). */
  from: IsoDate;
  to: IsoDate;
  start: number;
  end: number;
  n: number;
  clipStart: boolean;
  clipEnd: boolean;
  onOpen: (id: string) => void;
  t: ReturnType<typeof useTranslations<"Dashboard.chart">>;
}) {
  const kind = barKind(b);
  const nights = diffDays(b.checkIn, b.checkOut);
  // Blocked or imported nights carry no guest: the bar names where they come from.
  const guest =
    kind !== "blocked"
      ? b.guestName || t("noGuest")
      : b.source === "direct"
        ? t("statusLabel.blocked")
        : t("blockedFrom", { source: t(`source.${b.source}`) });
  // On the bar itself an import shows only its source ("Booking.com"): the colour already says blocked.
  const text = kind === "blocked" && b.source !== "direct" ? t(`source.${b.source}`) : guest;
  const status = t(`status.${kind}`);
  const label = t("bar", {
    guest,
    checkIn: fmt.short(b.checkIn),
    checkOut: fmt.short(b.checkOut),
    nights: t("nights", { count: nights }),
    status: b.optimistic ? t("saving") : status,
    source: t(`source.${b.source}`),
  });
  const Icon = SOURCE_ICON[b.source];
  // A short calendar import (under 3 shown nights) has no room for its source name: icon only.
  const iconOnly = Boolean(Icon) && kind === "blocked" && b.source !== "direct" && end - start < 3;

  return (
    <button
      type="button"
      data-testid="chart-bar"
      data-booking-id={b.id}
      data-unit-id={b.unitId}
      data-status={b.status}
      data-source={b.source}
      data-kind={kind}
      data-check-in={b.checkIn}
      data-check-out={b.checkOut}
      data-from={from}
      data-to={to}
      data-optimistic={b.optimistic ? "" : undefined}
      data-clip-start={clipStart ? "" : undefined}
      data-clip-end={clipEnd ? "" : undefined}
      data-icon-only={iconOnly ? "" : undefined}
      aria-label={label}
      title={label}
      disabled={b.optimistic}
      onClick={() => onOpen(b.id)}
      className={`bar absolute inset-y-1.5 z-[5] flex min-w-0 items-center gap-1 overflow-hidden text-left text-xs font-semibold shadow-sm transition-[filter,opacity] duration-150 ${iconOnly ? "justify-center px-0" : "px-2"} hover:brightness-110 focus-visible:z-[6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-progress ${
        clipStart ? "rounded-l-none" : "rounded-l-lg"
      } ${clipEnd ? "rounded-r-none" : "rounded-r-lg"} ${
        kind === "confirmed"
          ? "bg-accent text-cream-50"
          : kind === "hold"
            ? "bar-hold border border-accent/40 text-ink"
            : "border border-sand-200 bg-sand-200 text-ink"
      } ${b.optimistic ? "bar-pending opacity-70" : ""}`}
      style={{ left: `calc(${(start / n) * 100}% + 2px)`, width: `calc(${((end - start) / n) * 100}% - 4px)` }}
    >
      {Icon && <Icon aria-hidden className="size-3.5 shrink-0 opacity-75" />}
      {/* On the hatched hold the name sits on a solid chip, so it stays readable (AA) over the stripes. */}
      {!iconOnly && (
        <span className={kind === "hold" ? "min-w-0 truncate rounded bg-cream-50 px-1 py-px" : "truncate"}>{text}</span>
      )}
    </button>
  );
}
