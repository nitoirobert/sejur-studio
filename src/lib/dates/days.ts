// Calendar days as "YYYY-MM-DD" strings. All arithmetic runs on UTC midnights, so a day is always
// exactly 86 400 000 ms and daylight-saving changes in Europe/Bucharest (or the browser's zone)
// can never merge or split a column. Never feed these into local-time Date methods.

export type IsoDate = string;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** UTC midnight in ms for a real calendar date in years 2000-2099, else null. */
export function isoToUtc(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = ISO.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2099) return null;
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  // 2026-02-30 rolls over to March in Date.UTC; reject it.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return ms;
}

export function isIsoDate(value: unknown): value is IsoDate {
  return isoToUtc(value) !== null;
}

function utcToIso(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

function must(iso: IsoDate): number {
  const ms = isoToUtc(iso);
  if (ms === null) throw new RangeError(`not a date: ${iso}`);
  return ms;
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return utcToIso(must(iso) + days * DAY_MS);
}

/** Whole days from `a` to `b` (b - a). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((must(b) - must(a)) / DAY_MS);
}

/** `count` consecutive days starting at `from`. */
export function dayRange(from: IsoDate, count: number): IsoDate[] {
  const start = must(from);
  return Array.from({ length: count }, (_, i) => utcToIso(start + i * DAY_MS));
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(iso: IsoDate): number {
  return new Date(must(iso)).getUTCDay();
}

export function isWeekend(iso: IsoDate): boolean {
  const d = weekday(iso);
  return d === 0 || d === 6;
}

/** A Date for Intl formatting; always format it with `timeZone: "UTC"`. */
export function isoToDate(iso: IsoDate): Date {
  return new Date(must(iso));
}
