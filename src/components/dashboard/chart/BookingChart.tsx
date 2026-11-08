"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { pill, pillActive, primaryButton } from "@/components/ui/soft";
import { addDays, dayRange, diffDays, type IsoDate } from "@/lib/dates/days";
import { VIEW_DAYS, chartHref, defaultFrom } from "@/lib/dates/chart-params";
import { BookingDetails } from "../booking/BookingDetails";
import { BookingForm, type Draft } from "../booking/BookingForm";
import { useOverview } from "../booking/OverviewProvider";
import { Sheet } from "../booking/Sheet";
import { ChartGrid, type Selection } from "./ChartGrid";
import { fmt } from "./format";
import type { ChartBooking, ChartData } from "./types";

const panel = "rounded-card border border-glass-line bg-glass shadow-glass backdrop-blur-xl backdrop-saturate-150";

/** Name of the performance entry fe-03 reads: render + commit of the chart, per mount or new data. */
export const RENDER_MEASURE = "booking-chart-render";
const RENDER_MARK = "booking-chart-render-start";

export function BookingChart({ data }: { data: ChartData }) {
  const t = useTranslations("Dashboard");
  const router = useRouter();
  const { pending, saving } = useOverview();
  const { today, from, days: n, property, properties, allProperties } = data;
  const to = addDays(from, n);

  if (typeof window !== "undefined") performance.mark(RENDER_MARK);
  useLayoutEffect(() => {
    try {
      performance.measure(RENDER_MEASURE, RENDER_MARK);
    } catch {
      // the mark is missing only if the entries were cleared in between
    }
  }, [data]);

  const days = useMemo(() => dayRange(from, n), [from, n]);

  // Phone (< md): 7 days by default. Only when the URL does not choose a view itself.
  useEffect(() => {
    if (n === 7 || new URLSearchParams(window.location.search).has("zile")) return;
    if (!window.matchMedia("(max-width: 767.98px)").matches) return;
    router.replace(chartHref({ from, days: 7, property }), { scroll: false });
  }, [n, from, property, router]);

  const units = useMemo(() => {
    const m = new Map<string, { unit: string; property: string }>();
    for (const p of properties) for (const u of p.units) m.set(u.id, { unit: u.name, property: p.name });
    return m;
  }, [properties]);

  // Server bookings plus the ones being saved, in view only.
  const bookings = useMemo(
    () => [...data.bookings, ...pending.filter((b) => units.has(b.unitId) && b.checkOut > from && b.checkIn < to)],
    [data.bookings, pending, units, from, to],
  );

  const bookingsByUnit = useMemo(() => {
    const m = new Map<string, ChartBooking[]>();
    for (const b of bookings) {
      const list = m.get(b.unitId);
      if (list) list.push(b);
      else m.set(b.unitId, [b]);
    }
    return m;
  }, [bookings]);

  const [draft, setDraft] = useState<(Draft & { key: number }) | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const select = useCallback((s: Selection) => {
    setNotice(null);
    setDraft({ unitId: s.unitId, checkIn: s.checkIn, checkOut: s.checkOut, key: Date.now() });
  }, []);

  const firstUnit = properties[0]?.units[0];
  const newBooking = () => {
    if (!firstUnit) return;
    const start = from > today ? from : today;
    select({ unitId: firstUnit.id, checkIn: start, checkOut: addDays(start, 1) });
  };

  const opened = openId ? (bookings.find((b) => b.id === openId) ?? null) : null;
  const href = (next: { from?: IsoDate; days?: (typeof VIEW_DAYS)[number]; property?: string | null }) =>
    chartHref({ from: next.from ?? from, days: next.days ?? n, property: next.property === undefined ? property : next.property });

  const unitCount = properties.reduce((s, p) => s + p.units.length, 0);

  return (
    <>
      <section
        data-testid="booking-chart"
        data-from={from}
        data-days={n}
        data-today={today}
        aria-label={t("chart.region", { from: fmt.short(from), to: fmt.short(addDays(to, -1)) })}
        className={`${panel} mt-4 min-w-0 overflow-hidden md:mt-5`}
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-4 pt-4 sm:px-6 sm:pt-6">
          <h2 className="mr-auto font-serif text-2xl text-ink">{t("chart.title")}</h2>
          <button
            type="button"
            data-testid="chart-new-booking"
            onClick={newBooking}
            disabled={!firstUnit}
            className={`${primaryButton} min-h-11 px-4 disabled:opacity-60 dark:bg-accent-strong dark:font-bold dark:text-[#0d1626] dark:hover:bg-accent`}
          >
            <CalendarPlus className="size-4" aria-hidden />
            {t("chart.newBooking")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-6">
          <nav aria-label={t("chart.view")} className="flex items-center gap-1">
            <Link
              href={href({ from: addDays(from, -n) })}
              data-testid="chart-prev"
              aria-label={t("chart.prev")}
              title={t("chart.prev")}
              className={`${pill} size-11 justify-center p-0`}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <Link href={href({ from: defaultFrom(today) })} data-testid="chart-today" className={`${pill} h-11 px-4`}>
              {t("chart.today")}
            </Link>
            <Link
              href={href({ from: addDays(from, n) })}
              data-testid="chart-next"
              aria-label={t("chart.next")}
              title={t("chart.next")}
              className={`${pill} size-11 justify-center p-0`}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </nav>
          <p data-testid="chart-range" className="px-1 text-sm font-medium text-ink tabular-nums">
            {fmt.short(from)} – {fmt.short(addDays(to, -1))}
          </p>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div role="group" aria-label={t("chart.view")} className="flex items-center gap-1">
              {VIEW_DAYS.map((d) => (
                <Link
                  key={d}
                  href={href({ days: d })}
                  data-testid={`chart-days-${d}`}
                  aria-current={d === n ? "true" : undefined}
                  className={`${d === n ? pillActive : pill} h-11 px-3.5 text-sm`}
                >
                  {t("chart.days", { n: d })}
                </Link>
              ))}
            </div>
            {allProperties.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <span className="sr-only">{t("chart.property")}</span>
                <select
                  data-testid="chart-property-filter"
                  value={property ?? ""}
                  onChange={(e) => router.push(href({ property: e.target.value || null }))}
                  className="h-11 max-w-[14rem] rounded-full border border-glass-line bg-cream-100/85 px-4 text-sm text-ink shadow-pressed outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
                >
                  <option value="">{t("chart.allProperties")}</option>
                  {allProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        <Legend />

        <div role="status" aria-live="polite" className="px-4 sm:px-6">
          {notice && (
            <p data-testid="booking-saved" className="mt-3 rounded-inner bg-accent-50 px-4 py-2.5 text-sm font-medium text-accent">
              {notice}
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-glass-line">
          {unitCount > 0 ? (
            <ChartGrid
              days={days}
              today={today}
              properties={properties}
              bookingsByUnit={bookingsByUnit}
              onSelect={select}
              onOpen={setOpenId}
            />
          ) : (
            <div data-testid="chart-empty" className="px-4 py-10 text-center text-[15px] text-ink-soft sm:px-6">
              <p>{property ? t("chart.noUnitsFiltered") : t("chart.noUnits")}</p>
              {property ? (
                <Link href={href({ property: null })} className={`${pill} mt-4 inline-flex h-11 px-4`}>
                  {t("chart.showAll")}
                </Link>
              ) : (
                <Link href="/dashboard/proprietati" data-testid="chart-empty-properties" className={`${pill} mt-4 inline-flex h-11 px-4`}>
                  {t("chart.goProperties")}
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="mt-4 grid gap-4 md:mt-5 md:gap-5 lg:grid-cols-2">
        <Arrivals bookings={bookings} today={today} from={from} to={to} units={units} onOpen={setOpenId} />
        <Occupancy data={data} bookings={bookings} />
      </div>

      <BookingDetails
        booking={opened}
        unitName={opened ? (units.get(opened.unitId)?.unit ?? "") : ""}
        propertyName={opened ? (units.get(opened.unitId)?.property ?? "") : ""}
        onClose={() => setOpenId(null)}
      />

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        busy={saving}
        title={t("booking.title")}
        closeLabel={t("booking.close")}
        testId="booking-sheet"
      >
        {draft && (
          <BookingForm
            key={draft.key}
            draft={draft}
            properties={properties}
            onCancel={() => setDraft(null)}
            onSaved={(guest) => {
              setDraft(null);
              setNotice(t("booking.saved", { guest }));
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function Legend() {
  const t = useTranslations("Dashboard.chart");
  const items = [
    { key: "confirmed", swatch: "bg-accent" },
    { key: "hold", swatch: "bar-hold border border-accent/40" },
    { key: "blocked", swatch: "bg-sand-200 border border-sand-200" },
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3 text-[13px] text-ink-soft sm:px-6">
      <span className="sr-only">{t("legend.label")}</span>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-1.5">
            <span aria-hidden className={`inline-block h-3 w-5 rounded ${i.swatch}`} />
            {t(`legend.${i.key}`)}
          </li>
        ))}
      </ul>
      <p className="basis-full pointer-coarse:hidden md:ml-auto md:basis-auto">{t("hintDrag")}</p>
      <p className="hidden basis-full pointer-coarse:block">{t("hintTap")}</p>
    </div>
  );
}

function Arrivals({
  bookings,
  today,
  from,
  to,
  units,
  onOpen,
}: {
  bookings: ChartBooking[];
  today: IsoDate;
  from: IsoDate;
  to: IsoDate;
  units: Map<string, { unit: string; property: string }>;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("Dashboard");
  const start = from > today ? from : today;
  const list = bookings
    .filter((b) => b.status !== "blocked" && b.checkIn >= start && b.checkIn < to)
    .sort((a, b) => (a.checkIn === b.checkIn ? (a.guestName ?? "").localeCompare(b.guestName ?? "", "ro") : a.checkIn < b.checkIn ? -1 : 1))
    .slice(0, 5);
  const showToday = today < from || today >= to;

  return (
    <section data-testid="arrivals" aria-labelledby="arrivals-title" className={`${panel} min-w-0 p-5 sm:p-6`}>
      <h2 id="arrivals-title" className="font-serif text-xl text-ink">
        {t("arrivals.title")}
      </h2>
      <p className="mt-0.5 text-[13px] text-ink-soft">{t("arrivals.hint")}</p>
      {list.length === 0 ? (
        <div className="mt-4 text-[15px] text-ink-soft">
          <p data-testid="arrivals-empty">{t("arrivals.empty")}</p>
          {showToday && (
            <Link href={chartHref({ from: defaultFrom(today), days: 14, property: null })} className={`${pill} mt-3 inline-flex h-11 px-4`}>
              {t("arrivals.goToday")}
            </Link>
          )}
        </div>
      ) : (
        <ul data-testid="arrivals-list" className="mt-3 divide-y divide-glass-line">
          {list.map((b) => {
            const where = units.get(b.unitId);
            return (
              <li key={b.id}>
                <button
                  type="button"
                  data-testid="arrival-item"
                  data-booking-id={b.id}
                  disabled={b.optimistic}
                  onClick={() => onOpen(b.id)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-inner px-2 py-2 text-left transition-colors hover:bg-cream-50/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-70"
                >
                  <span className="grid w-12 shrink-0 place-items-center rounded-inner bg-cream-100 py-1.5 leading-none">
                    <span className="text-[11px] text-ink-soft">{fmt.weekday(b.checkIn)}</span>
                    <span className="mt-0.5 text-base font-semibold text-ink tabular-nums">{fmt.day(b.checkIn)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{b.guestName || t("chart.noGuest")}</span>
                    <span className="block truncate text-[13px] text-ink-soft">
                      {where ? `${where.unit} · ${where.property}` : ""} · {t("chart.nights", { count: diffDays(b.checkIn, b.checkOut) })}
                    </span>
                  </span>
                  {b.status === "hold" && (
                    <span className="shrink-0 rounded-full border border-dashed border-accent/60 bg-cream-50 px-2.5 py-1 text-[11px] font-semibold text-ink">
                      {t("chart.statusLabel.hold")}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Occupancy({ data, bookings }: { data: ChartData; bookings: ChartBooking[] }) {
  const t = useTranslations("Dashboard");
  const { from, days: n, properties } = data;
  // Same rule as the KPI: confirmed and blocked nights count, holds do not.
  const rows = properties.map((p) => {
    const ids = new Set(p.units.map((u) => u.id));
    let nights = 0;
    for (const b of bookings) {
      if (!ids.has(b.unitId) || (b.status !== "confirmed" && b.status !== "blocked")) continue;
      const s = Math.max(diffDays(from, b.checkIn), 0);
      const e = Math.min(diffDays(from, b.checkOut), n);
      if (e > s) nights += e - s;
    }
    const total = p.units.length * n;
    const pct = total ? Math.min(100, Math.round((nights / total) * 100)) : 0;
    return { id: p.id, name: p.name, pct };
  });
  const pctFmt = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

  return (
    <section data-testid="occupancy" aria-labelledby="occupancy-title" className={`${panel} min-w-0 p-5 sm:p-6`}>
      <h2 id="occupancy-title" className="font-serif text-xl text-ink">
        {t("occupancy.title")}
      </h2>
      <p className="mt-0.5 text-[13px] text-ink-soft">{t("occupancy.hint")}</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-[15px] text-ink-soft">{t("occupancy.empty")}</p>
      ) : (
        <ul data-testid="occupancy-list" className="mt-4 space-y-4">
          {rows.map((r) => {
            const value = t("occupancy.value", { pct: pctFmt.format(r.pct) });
            return (
              <li key={r.id} data-testid="occupancy-item" data-property={r.id} data-pct={r.pct}>
                <div className="flex items-baseline justify-between gap-3 text-[15px]">
                  <span className="truncate text-ink">{r.name}</span>
                  <span className="font-semibold text-ink tabular-nums">{value}</span>
                </div>
                <div
                  role="meter"
                  aria-label={r.name}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={r.pct}
                  aria-valuetext={value}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-cream-100"
                >
                  <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${r.pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
