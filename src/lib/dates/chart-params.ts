import { addDays, isIsoDate, type IsoDate } from "./days";

// URL state of the bookings chart: ?de=YYYY-MM-DD&zile=7|14|30&proprietate=<uuid>.
// Anything malformed falls back to the default; nothing here throws.

export const VIEW_DAYS = [7, 14, 30] as const;
export type ViewDays = (typeof VIEW_DAYS)[number];
export const DEFAULT_DAYS: ViewDays = 14;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ChartParams = { from: IsoDate; days: ViewDays; property: string | null };
type Raw = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The window opens one day before today, so yesterday's departures stay in view. */
export function defaultFrom(today: IsoDate): IsoDate {
  return addDays(today, -1);
}

export function parseChartParams(raw: Raw, today: IsoDate): ChartParams {
  const de = first(raw.de);
  const zile = Number(first(raw.zile));
  const prop = first(raw.proprietate);
  return {
    from: isIsoDate(de) ? de : defaultFrom(today),
    days: (VIEW_DAYS as readonly number[]).includes(zile) ? (zile as ViewDays) : DEFAULT_DAYS,
    property: typeof prop === "string" && UUID.test(prop) ? prop.toLowerCase() : null,
  };
}

export function chartHref({ from, days, property }: ChartParams): string {
  const q = new URLSearchParams({ de: from, zile: String(days) });
  if (property) q.set("proprietate", property);
  return `/dashboard?${q.toString()}`;
}

/** The window as [from, to) for dashboard_chart. */
export function chartWindow({ from, days }: ChartParams): { from: IsoDate; to: IsoDate } {
  return { from, to: addDays(from, days) };
}
