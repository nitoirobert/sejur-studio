"use client";

import { createContext, use, useCallback, useOptimistic, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { createManualBooking } from "@/app/dashboard/actions";
import type { IsoDate } from "@/lib/dates/days";
import type { ChartBooking } from "../chart/types";
import type { BookingResult, ManualBookingInput } from "./schema";

/*
  Optimistic bookings shared by the KPI cards and the chart.
  A save runs in one transition: the bar is added at once (useOptimistic); the server action
  answers and, on success, refresh()es the page in the same response. When the transition ends the
  optimistic list empties and the server data already holds the real bar: one bar, no reload.
  On an error nothing is refreshed, so the bar and the KPI go back to what they were.
*/

type Ctx = {
  today: IsoDate;
  unitsTotal: number;
  pending: ChartBooking[];
  saving: boolean;
  create: (input: ManualBookingInput, preview: ChartBooking) => Promise<BookingResult>;
};

const OverviewContext = createContext<Ctx | null>(null);

/** null outside the overview page (the KPI cards then show the server values as they are). */
export function useOverviewOptional(): Ctx | null {
  return use(OverviewContext);
}

export function useOverview(): Ctx {
  const ctx = use(OverviewContext);
  if (!ctx) throw new Error("useOverview must be used inside OverviewProvider");
  return ctx;
}

export function OverviewProvider({
  today,
  unitsTotal,
  children,
}: {
  today: IsoDate;
  unitsTotal: number;
  children: React.ReactNode;
}) {
  const [pending, addPending] = useOptimistic<ChartBooking[], ChartBooking>([], (list, b) => [...list, b]);
  const [saving, startTransition] = useTransition();

  const create = useCallback(
    (input: ManualBookingInput, preview: ChartBooking) =>
      new Promise<BookingResult>((resolve) => {
        startTransition(async () => {
          addPending({ ...preview, optimistic: true });
          let result: BookingResult;
          try {
            result = await createManualBooking(input);
          } catch (e) {
            // redirect() / notFound() from the action (session gone) must reach Next, not become an error message.
            unstable_rethrow(e);
            // Network drop, abort or a 500: nothing was confirmed, roll back.
            result = { ok: false, code: "generic" };
          }
          resolve(result);
        });
      }),
    [addPending],
  );

  return (
    <OverviewContext value={{ today, unitsTotal, pending, saving, create }}>{children}</OverviewContext>
  );
}
