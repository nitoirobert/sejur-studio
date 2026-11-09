import { isoToDate, type IsoDate } from "@/lib/dates/days";

// Calendar days are UTC midnights (lib/dates): format them in UTC so the browser's zone never shifts them.
const weekdayShort = new Intl.DateTimeFormat("ro-RO", { weekday: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", timeZone: "UTC" });
const dayMonthYear = new Intl.DateTimeFormat("ro-RO", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const monthYear = new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric", timeZone: "UTC" });
const moment = new Intl.DateTimeFormat("ro-RO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Bucharest",
});

const clean = (s: string) => s.replace(/\.$/, "");

export const fmt = {
  /** "lun" */
  weekday: (d: IsoDate) => clean(weekdayShort.format(isoToDate(d))),
  /** "10 nov." */
  short: (d: IsoDate) => dayMonth.format(isoToDate(d)),
  /** "mar., 10 noiembrie 2026" */
  long: (d: IsoDate) => dayMonthYear.format(isoToDate(d)),
  /** "noiembrie 2026" */
  month: (d: IsoDate) => monthYear.format(isoToDate(d)),
  /** A timestamp (hold expiry) in Bucharest time. */
  moment: (ts: string) => moment.format(new Date(ts)),
  day: (d: IsoDate) => Number(d.slice(8, 10)),
};

const leiWhole = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
const leiCents = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Bani -> "1.234,50 lei" (or "1.234 lei"); other currencies keep their code. */
export function formatMoney(bani: number, currency: string, lei: string): string {
  const major = bani / 100;
  const text = (bani % 100 === 0 ? leiWhole : leiCents).format(major);
  return `${text} ${currency === "RON" ? lei : currency}`;
}

// Property colours of the chart: distinct, calm hues that read on the glass panels in light and dark
// themes, and stay apart from the booking colours (navy = confirmed, sand = blocked).
export const PROPERTY_COLORS = ["#2f8f83", "#c0663f", "#7b5ea7", "#3f7cc0", "#b0892a", "#c2477a", "#5c8a3a", "#8a6a4f"];
