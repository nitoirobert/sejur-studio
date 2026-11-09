import { addDays, weekday, type IsoDate } from "./days";

/*
  Romanian days off and popular travel dates, as ready-made stays for the date picker.

  The long-weekend algorithm ("punte"):
  1. A day is FREE when it is a Saturday, a Sunday or a legal holiday (Codul muncii, art. 139),
     looked up across year ends (Christmas + New Year, Easter + 1 May).
  2. Starting from a holiday, the block grows over every adjacent free day.
  3. Then it tries bridges: up to 2 working days on the left and/or right (at most 2 in total) that,
     taken as days of leave, join the block to the next free run (e.g. Monday between a weekend and a
     Tuesday holiday). Every combination is scored as `free days gained - 1.5 x days of leave`;
     the best wins (+1 when the trip ends on a Sunday), ties go to fewer days of leave. A bridge that does not reach a free day is useless.
  4. The stay checks in on the first day of the block and checks out the day after its last day.
  Popular days that are not days off (Dragobete) and New Year's Eve (31 Dec is a working day, but
  that is when people travel) keep a simple rule: arrive the evening before, at least 2 nights.
  The government sometimes adds extra days off for the public sector; those are announced late and
  are not in this list.
*/

export type HolidayKey =
  | "newYear"
  | "epiphany"
  | "union"
  | "dragobete"
  | "easter"
  | "labour"
  | "children"
  | "pentecost"
  | "assumption"
  | "standrew"
  | "national"
  | "christmas";

export type HolidayStay = {
  key: HolidayKey;
  days: IsoDate[]; // the holiday itself
  from: IsoDate; // check-in
  to: IsoDate; // check-out
  nights: number;
  leave: IsoDate[]; // working days to take off ("zile de punte"); empty = no leave needed
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number): IsoDate => `${y}-${pad(m)}-${pad(d)}`;
const nightsOf = (from: IsoDate, to: IsoDate) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** Orthodox Easter Sunday (Gregorian date): Meeus' Julian algorithm + 13 days (valid 1900-2099). */
export function orthodoxEaster(year: number): IsoDate {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // Julian calendar
  const day = ((d + e + 114) % 31) + 1;
  return addDays(iso(year, month, day), 13);
}

/** The holidays of one year. `legal` = a day off by law; otherwise only a popular date. */
export function holidaysOf(year: number): { key: HolidayKey; days: IsoDate[]; legal: boolean }[] {
  const easter = orthodoxEaster(year);
  const pentecost = addDays(easter, 49);
  return [
    { key: "newYear", days: [iso(year, 1, 1), iso(year, 1, 2)], legal: true },
    { key: "epiphany", days: [iso(year, 1, 6), iso(year, 1, 7)], legal: true },
    { key: "union", days: [iso(year, 1, 24)], legal: true },
    { key: "dragobete", days: [iso(year, 2, 24)], legal: false },
    { key: "easter", days: [addDays(easter, -2), easter, addDays(easter, 1)], legal: true },
    { key: "labour", days: [iso(year, 5, 1)], legal: true },
    { key: "children", days: [iso(year, 6, 1)], legal: true },
    { key: "pentecost", days: [pentecost, addDays(pentecost, 1)], legal: true },
    { key: "assumption", days: [iso(year, 8, 15)], legal: true },
    { key: "standrew", days: [iso(year, 11, 30), iso(year, 12, 1)], legal: true },
    { key: "christmas", days: [iso(year, 12, 25), iso(year, 12, 26)], legal: true },
  ];
}

/** Legal days off of the given years (and the neighbours, so blocks can cross a year end). */
export function legalDaysOff(years: number[]): Set<IsoDate> {
  const out = new Set<IsoDate>();
  for (const y of new Set(years.flatMap((y) => [y - 1, y, y + 1])))
    for (const h of holidaysOf(y)) if (h.legal) for (const d of h.days) out.add(d);
  return out;
}

const isWeekendDay = (d: IsoDate) => {
  const w = weekday(d);
  return w === 0 || w === 6;
};

const MAX_LEAVE = 2;
const LEAVE_COST = 1.5;

/** The best long weekend around some days off: the block of free days, plus bridge days of leave. */
export function longWeekend(days: IsoDate[], off: Set<IsoDate>, maxLeave = MAX_LEAVE): { first: IsoDate; last: IsoDate; leave: IsoDate[] } {
  const free = (d: IsoDate) => isWeekendDay(d) || off.has(d) || days.includes(d);
  const sorted = [...days].sort();
  let first = sorted[0];
  let last = sorted[sorted.length - 1];
  while (free(addDays(first, -1))) first = addDays(first, -1);
  while (free(addDays(last, 1))) last = addDays(last, 1);

  // A bridge of k working days on one side, valid only if it lands on a free day; then grow over that run.
  const reach = (edge: IsoDate, step: 1 | -1, k: number): { edge: IsoDate; leave: IsoDate[] } | null => {
    if (k === 0) return { edge, leave: [] };
    const leave: IsoDate[] = [];
    let d = edge;
    for (let i = 0; i < k; i++) {
      d = addDays(d, step);
      if (free(d)) return null; // the gap is shorter than k: the smaller k covers it
      leave.push(d);
    }
    if (!free(addDays(d, step))) return null;
    while (free(addDays(d, step))) d = addDays(d, step);
    return { edge: d, leave };
  };

  // Small bonus when the trip ends on a Sunday (it keeps the weekend after the holiday instead of
  // joining a different holiday days before it, e.g. Epiphany 2027 -> Wed 6 - Sun 10, not 1-7 Jan).
  const weekendAfter = (d: IsoDate) => (weekday(d) === 0 ? 1 : 0);
  let best = { first, last, leave: [] as IsoDate[], score: nightsOf(first, addDays(last, 1)) + weekendAfter(last) };
  for (let l = 0; l <= maxLeave; l++) {
    for (let r = 0; l + r <= maxLeave; r++) {
      if (l + r === 0) continue;
      const left = reach(first, -1, l);
      const right = reach(last, 1, r);
      if (!left || !right) continue;
      const leave = [...left.leave, ...right.leave].sort();
      const length = nightsOf(left.edge, addDays(right.edge, 1));
      const score = length - LEAVE_COST * leave.length + weekendAfter(right.edge);
      if (score > best.score) best = { first: left.edge, last: right.edge, leave, score };
    }
  }
  return { first: best.first, last: best.last, leave: best.leave };
}

/** Simple stay for a date that is not a day off: grow over a touching weekend, else arrive the
 *  evening before; at least 2 nights. */
export function stayAround(days: IsoDate[]): { from: IsoDate; to: IsoDate } {
  const sorted = [...days].sort();
  let first = sorted[0];
  let last = sorted[sorted.length - 1];
  const set = new Set(sorted);
  while (isWeekendDay(addDays(first, -1)) || set.has(addDays(first, -1))) first = addDays(first, -1);
  while (isWeekendDay(addDays(last, 1)) || set.has(addDays(last, 1))) last = addDays(last, 1);
  const from = first === last ? addDays(first, -1) : first;
  return { from, to: addDays(last, 1) };
}

/** The stay for one holiday. */
export function holidayStay(h: { key: HolidayKey; days: IsoDate[]; legal: boolean }, off: Set<IsoDate>): HolidayStay {
  if (h.key === "newYear") {
    // Revelion: arrive on 31 Dec (a working day, the night of the party), stay over the free days after.
    // No bridges: it is a party trip, and a bridge would swallow Epiphany into one long holiday.
    const eve = addDays(h.days[0], -1);
    const w = longWeekend(h.days, off, 0);
    const to = addDays(w.last, 1);
    return { key: h.key, days: h.days, from: w.first < eve ? w.first : eve, to, nights: nightsOf(w.first < eve ? w.first : eve, to), leave: [] };
  }
  if (!h.legal) {
    const { from, to } = stayAround(h.days);
    return { key: h.key, days: h.days, from, to, nights: nightsOf(from, to), leave: [] };
  }
  const w = longWeekend(h.days, off);
  let from = w.first;
  const to = addDays(w.last, 1);
  if (nightsOf(from, to) < 2) from = addDays(from, -1); // a lone free day: arrive the evening before
  return { key: h.key, days: h.days, from, to, nights: nightsOf(from, to), leave: w.leave };
}

/** Upcoming holiday stays (check-in today or later, within `horizonDays`), soonest first. */
export function upcomingHolidayStays(today: IsoDate, limit = 10, horizonDays = 365): HolidayStay[] {
  const year = Number(today.slice(0, 4));
  const years = Array.from({ length: Math.ceil(horizonDays / 365) + 1 }, (_, i) => year + i);
  const off = legalDaysOff(years);
  const all = years.flatMap((y) => holidaysOf(y).map((h) => holidayStay(h, off)));
  const yearAhead = addDays(today, horizonDays);
  const sorted = all
    .filter((s) => s.from >= today && s.from < yearAhead)
    .sort((a, b) => a.from.localeCompare(b.from) || b.to.localeCompare(a.to));
  // A stay that falls entirely inside another one (1 May inside Easter in 2027) is the same trip: keep the longer one.
  const kept: HolidayStay[] = [];
  for (const s of sorted) if (!kept.some((k) => k.from <= s.from && s.to <= k.to)) kept.push(s);
  return kept.slice(0, limit);
}

/** Every holiday day of the years shown, for the dots in the calendar grid. */
export function holidayDaySet(years: number[]): Map<IsoDate, HolidayKey> {
  const out = new Map<IsoDate, HolidayKey>();
  for (const y of years) for (const h of holidaysOf(y)) for (const d of h.days) out.set(d, h.key);
  return out;
}
