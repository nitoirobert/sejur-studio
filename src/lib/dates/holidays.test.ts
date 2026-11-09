import { describe, expect, it } from "vitest";
import { holidaysOf, holidayStay, legalDaysOff, longWeekend, orthodoxEaster, stayAround, upcomingHolidayStays } from "./holidays";

const stayFor = (year: number, key: string) => {
  const h = holidaysOf(year).find((x) => x.key === key)!;
  return holidayStay(h, legalDaysOff([year]));
};

describe("holidays", () => {
  it("computes Orthodox Easter", () => {
    expect(orthodoxEaster(2024)).toBe("2024-05-05");
    expect(orthodoxEaster(2025)).toBe("2025-04-20");
    expect(orthodoxEaster(2026)).toBe("2026-04-12");
    expect(orthodoxEaster(2027)).toBe("2027-05-02");
  });

  it("joins a holiday to the weekend it touches, without leave", () => {
    // 1 May 2026 is a Friday: Fri-Sun
    expect(stayFor(2026, "labour")).toMatchObject({ from: "2026-05-01", to: "2026-05-04", leave: [] });
    // 30 Nov (Mon) + 1 Dec (Tue) 2026: Sat-Tue
    expect(stayFor(2026, "standrew")).toMatchObject({ from: "2026-11-28", to: "2026-12-02", leave: [] });
    // Easter is Fri-Mon by law
    expect(stayFor(2026, "easter")).toMatchObject({ from: "2026-04-10", to: "2026-04-14", leave: [] });
  });

  it("suggests a bridge day when a holiday is on Tuesday or Thursday", () => {
    // 15 Aug 2024 is a Thursday: take Friday 16 off -> Thu-Sun
    expect(stayFor(2024, "assumption")).toMatchObject({ from: "2024-08-15", to: "2024-08-19", leave: ["2024-08-16"] });
    // 24 Jan 2023 is a Tuesday: take Monday 23 off -> Sat-Tue
    expect(stayFor(2023, "union")).toMatchObject({ from: "2023-01-21", to: "2023-01-25", leave: ["2023-01-23"] });
  });

  it("bridges two holidays with the working day between them", () => {
    // 2024: 1 May (Wed), 2 May (Thu, working), 3 May Good Friday ... 6 May Easter Monday
    const off = legalDaysOff([2024]);
    expect(longWeekend(["2024-05-01"], off)).toEqual({ first: "2024-05-01", last: "2024-05-06", leave: ["2024-05-02"] });
  });

  it("takes 2 days of leave for a Wednesday holiday only when it pays off", () => {
    // 24 Jan 2024 is a Wednesday: Mon-Tue or Thu-Fri off gives 5 days for 2 of leave
    const w = longWeekend(["2024-01-24"], legalDaysOff([2024]));
    expect(w.leave).toHaveLength(2);
    expect(w.last.localeCompare(w.first)).toBeGreaterThan(0);
  });

  it("keeps simple stays for popular dates", () => {
    // 24 Feb 2027 is a Wednesday and not a day off: arrive the evening before, 2 nights
    expect(stayAround(["2027-02-24"])).toEqual({ from: "2027-02-23", to: "2027-02-25" });
    expect(stayFor(2027, "dragobete")).toMatchObject({ nights: 2, leave: [] });
  });

  it("keeps the weekend after Epiphany instead of joining New Year", () => {
    // 2027: 6 (Wed) and 7 (Thu) Jan off; take Friday 8 -> Wed 6 - Sun 10
    expect(stayFor(2027, "epiphany")).toMatchObject({ from: "2027-01-06", to: "2027-01-11", leave: ["2027-01-08"] });
  });

  it("starts Revelion on 31 December", () => {
    const s = stayFor(2027, "newYear"); // 1 Jan 2027 is a Friday
    expect(s.from).toBe("2026-12-31");
    expect(s.to).toBe("2027-01-04");
  });

  it("lists upcoming stays within one year, once each, and drops a stay inside another", () => {
    const list = upcomingHolidayStays("2026-11-10", 20);
    const keys = list.map((s) => s.key);
    expect(keys.slice(0, 4)).toEqual(["standrew", "christmas", "newYear", "epiphany"]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(list.every((s) => s.from >= "2026-11-10" && s.from < "2027-11-10" && s.nights >= 2)).toBe(true);
    expect(keys).not.toContain("labour"); // 1 May 2027 falls inside the Easter stay (30 Apr - 4 May)
  });
});
