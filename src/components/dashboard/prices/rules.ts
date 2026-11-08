import { z } from "zod";
import { addDays, dayRange, diffDays, isIsoDate, weekday, type IsoDate } from "@/lib/dates/days";
import { count, priceLei } from "@/components/dashboard/property/schema";

/*
  Price rules of one unit (unit_prices) and the 30-day preview.
  Same rule as public_quote in the database (brief 05): for each night, the season with the highest
  priority that contains it (equal priority: the newest created_at), else the weekend price on Friday
  and Saturday nights, else the base price.
  A season is stored as [date_from, date_to) with date_to exclusive; the screen shows the last night
  (inclusive): 1-31 Aug is saved with date_to = 1 Sep.
*/

export const MAX_SEASON_NIGHTS = 366;
export const MIN_NIGHTS_MAX = 60;
export const PRIORITY_MAX = 100;

export type PriceKind = "base" | "weekend" | "season";
export type PriceRule = {
  id: string;
  kind: PriceKind;
  price: number; // bani per night
  dateFrom: IsoDate | null;
  dateTo: IsoDate | null; // exclusive
  minNights: number;
  priority: number;
  createdAt: string;
};

/** Last night shown on screen -> exclusive date_to stored in the database. */
export const lastNightToDateTo = (lastNight: IsoDate): IsoDate => addDays(lastNight, 1);
/** Exclusive date_to from the database -> last night shown on screen. */
export const dateToToLastNight = (dateTo: IsoDate): IsoDate => addDays(dateTo, -1);

/** Friday and Saturday nights (the night that starts on that day). */
export const isWeekendNight = (night: IsoDate): boolean => {
  const d = weekday(night);
  return d === 5 || d === 6;
};

export type NightPrice = { night: IsoDate; price: number | null; kind: PriceKind | null; ruleId: string | null };

// Same order as public_quote: priority desc, created_at desc, id desc (uuid order = lowercase hex order).
const later = (a: PriceRule, b: PriceRule) =>
  a.createdAt !== b.createdAt ? a.createdAt > b.createdAt : a.id.toLowerCase() > b.id.toLowerCase();
const newer = (a: PriceRule, b: PriceRule) => (a.priority !== b.priority ? a.priority > b.priority : later(a, b));

/** The price of one night under the rules, or null when the unit has no base price. */
export function priceForNight(rules: PriceRule[], night: IsoDate): NightPrice {
  let season: PriceRule | null = null;
  let weekend: PriceRule | null = null;
  let base: PriceRule | null = null;
  for (const r of rules) {
    if (r.kind === "season") {
      if (r.dateFrom && r.dateTo && r.dateFrom <= night && night < r.dateTo && (!season || newer(r, season))) season = r;
    } else if (r.kind === "weekend") {
      if (!weekend || later(r, weekend)) weekend = r;
    } else if (!base || later(r, base)) {
      base = r;
    }
  }
  const pick = season ?? (weekend && isWeekendNight(night) ? weekend : null) ?? base;
  return { night, price: pick ? pick.price : null, kind: pick ? pick.kind : null, ruleId: pick?.id ?? null };
}

/** `days` nights starting at `from`. */
export function previewNights(rules: PriceRule[], from: IsoDate, days = 30): NightPrice[] {
  return dayRange(from, days).map((night) => priceForNight(rules, night));
}

/** Another season of the same unit with the same priority that shares at least one night. */
export function sameRankOverlap(
  seasons: Pick<PriceRule, "id" | "dateFrom" | "dateTo" | "priority">[],
  next: { id: string | null; dateFrom: IsoDate; dateTo: IsoDate; priority: number },
): boolean {
  return seasons.some(
    (s) =>
      s.id !== next.id &&
      s.priority === next.priority &&
      s.dateFrom !== null &&
      s.dateTo !== null &&
      s.dateFrom < next.dateTo &&
      next.dateFrom < s.dateTo,
  );
}

const isoDate = z.string().refine(isIsoDate, "date");

export const basePriceSchema = z.strictObject({
  unit_id: z.guid(),
  price: priceLei,
  min_nights: count(1, MIN_NIGHTS_MAX),
});

export const weekendSchema = basePriceSchema;

export const seasonSchema = z
  .strictObject({
    id: z.guid().nullable(),
    unit_id: z.guid(),
    first_night: isoDate,
    last_night: isoDate,
    price: priceLei,
    min_nights: count(1, MIN_NIGHTS_MAX),
    priority: count(0, PRIORITY_MAX),
  })
  .transform((v, ctx) => {
    const dateTo = lastNightToDateTo(v.last_night);
    const nights = diffDays(v.first_night, dateTo);
    // date_to <= date_from (the last night before the first) or a season longer than a year.
    if (nights < 1 || nights > MAX_SEASON_NIGHTS) {
      ctx.addIssue({ code: "custom", path: ["last_night"], message: "dates" });
      return z.NEVER;
    }
    return {
      id: v.id,
      unit_id: v.unit_id,
      date_from: v.first_night,
      date_to: dateTo,
      price: v.price,
      min_nights: v.min_nights,
      priority: v.priority,
    };
  });
export type SeasonInput = z.input<typeof seasonSchema>;
