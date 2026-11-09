import { addDays, diffDays, type IsoDate } from "@/lib/dates/days";
import type { ChartBooking } from "../chart/types";

// Same horizon and rules as dashboard_kpis (0008): arrivals/departures on the day, occupancy over
// [today, today + 30) as booked nights / (units x 30), confirmed and blocked only.
export const KPI_HORIZON = 30;

export type KpiBase = { arrivals: number; departures: number; occupancy: number };

const counts = (b: ChartBooking) => b.status === "confirmed" || b.status === "blocked";

/** Nights of [checkIn, checkOut) inside [from, to). */
export function nightsIn(b: Pick<ChartBooking, "checkIn" | "checkOut">, from: IsoDate, to: IsoDate): number {
  const start = b.checkIn > from ? b.checkIn : from;
  const end = b.checkOut < to ? b.checkOut : to;
  return end > start ? diffDays(start, end) : 0;
}

/** KPI values with the bookings still being saved added on top of the server values. */
export function withPending(base: KpiBase, pending: ChartBooking[], today: IsoDate, unitsTotal: number): KpiBase {
  const live = pending.filter(counts);
  if (live.length === 0) return base;
  const to = addDays(today, KPI_HORIZON);
  const nights = live.reduce((sum, b) => sum + nightsIn(b, today, to), 0);
  const occupancy =
    unitsTotal > 0 ? Math.round((base.occupancy + (100 * nights) / (unitsTotal * KPI_HORIZON)) * 10) / 10 : base.occupancy;
  return {
    arrivals: base.arrivals + live.filter((b) => b.checkIn === today).length,
    departures: base.departures + live.filter((b) => b.checkOut === today).length,
    occupancy: Math.min(100, occupancy),
  };
}
