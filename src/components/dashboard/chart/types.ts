import type { Database } from "../../../../supabase/types";
import type { IsoDate } from "@/lib/dates/days";

export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type BookingSource = Database["public"]["Enums"]["booking_source"];

/** One row of dashboard_chart, camelCased. `optimistic` marks a bar that is still being saved. */
export type ChartBooking = {
  id: string;
  unitId: string;
  propertyId: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
  status: BookingStatus;
  source: BookingSource;
  guestName: string | null;
  adults: number;
  children: number;
  totalAmount: number; // bani
  currency: string;
  holdExpiresAt: string | null;
  optimistic?: boolean;
};

export type ChartUnit = { id: string; name: string; propertyId: string };
export type ChartProperty = { id: string; name: string; units: ChartUnit[] };

export type ChartData = {
  today: IsoDate;
  from: IsoDate;
  days: 7 | 14 | 30;
  property: string | null;
  /** Properties in view (after the filter), each with its units in display order. */
  properties: ChartProperty[];
  /** Every property of the organization, for the filter. */
  allProperties: { id: string; name: string }[];
  bookings: ChartBooking[];
};

/** Bar look: hold hatched; blocked or imported (iCal) sand; a confirmed direct booking solid navy. */
export function barKind(b: Pick<ChartBooking, "status" | "source">): "confirmed" | "hold" | "blocked" {
  if (b.status === "hold") return "hold";
  if (b.status === "blocked" || b.source !== "direct") return "blocked";
  return "confirmed";
}
