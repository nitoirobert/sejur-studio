"use client";

import { useOverviewOptional } from "./OverviewProvider";
import { withPending, type KpiBase } from "./optimistic";

// Whole numbers everywhere (occupancy included), the same as the chart's occupancy list.
const number = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

function useLive(base: KpiBase): KpiBase {
  const ctx = useOverviewOptional();
  return ctx ? withPending(base, ctx.pending, ctx.today, ctx.unitsTotal) : base;
}

/** A KPI number that already counts the bookings still being saved. */
export function KpiLiveValue({ base, kind }: { base: KpiBase; kind: keyof KpiBase }) {
  return <>{number.format(useLive(base)[kind])}</>;
}

export function KpiLiveMeter({ base, label }: { base: KpiBase; label: string }) {
  const value = Math.min(100, Math.max(0, Math.round(useLive(base).occupancy)));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand/80"
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${value}%` }} />
    </div>
  );
}
