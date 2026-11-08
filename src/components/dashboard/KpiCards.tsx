import { cache } from "react";
import { getTranslations } from "next-intl/server";
import { requireViewer } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { KpiLiveMeter, KpiLiveValue } from "./booking/KpiLive";
import type { KpiBase } from "./booking/optimistic";

// Revenue: whole amounts with no decimals, anything else with exactly 2 (8.080 / 8.080,50).
const moneyWhole = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
const moneyCents = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (amount: number) => (Number.isInteger(amount) ? moneyWhole : moneyCents).format(amount);

// RON reads as "lei"; other ISO codes use the ro-RO symbol (EUR -> €).
function currencyLabel(code: string, lei: string) {
  if (code === "RON") return lei;
  try {
    const parts = new Intl.NumberFormat("ro-RO", { style: "currency", currency: code }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}
// kpi_day is a plain date; format it as a calendar day, not as a moment in a time zone.
const dayFormat = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

const NBSP = "\u00a0";

type Card = {
  key: "arrivals" | "departures" | "occupancy" | "revenue";
  value: React.ReactNode;
  unit?: string;
  hint: string;
  meter?: boolean;
};

// One dashboard_kpis call per request, shared with the chart: its "today" is kpi_day (bucharest_today()).
export const loadKpis = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_kpis");
  if (error || !data?.[0]) throw new Error("dashboard_kpis failed");
  return data[0];
});

// The 4 KPI cards, as the signed-in owner (RLS scopes the organization). Arrivals, departures and
// occupancy are client islands that add the bookings still being saved from the chart (optimistic).
export async function KpiCards() {
  await requireViewer();
  const [row, t] = await Promise.all([loadKpis(), getTranslations("Dashboard.kpi")]);

  const day = row.kpi_day;
  const occupancy = Number(row.occupancy_pct ?? 0);
  const revenue = Math.round(Number(row.revenue_month ?? 0)) / 100; // minor units -> major
  const dayLabel = day ? dayFormat.format(new Date(`${day}T00:00:00Z`)) : "";
  const base: KpiBase = { arrivals: row.arrivals_today ?? 0, departures: row.departures_today ?? 0, occupancy };
  const cards: Card[] = [
    {
      key: "arrivals",
      value: <KpiLiveValue base={base} kind="arrivals" />,
      hint: dayLabel,
    },
    {
      key: "departures",
      value: <KpiLiveValue base={base} kind="departures" />,
      hint: dayLabel,
    },
    {
      key: "occupancy",
      value: <KpiLiveValue base={base} kind="occupancy" />,
      unit: "%",
      hint: t("occupancyHint"),
      meter: true,
    },
    {
      key: "revenue",
      value: formatMoney(revenue),
      unit: `${NBSP}${currencyLabel(row.currency ?? "RON", t("currency"))}`,
      hint: t("revenueHint"),
    },
  ];

  return (
    <section aria-label={t("label")}>
      <ul className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {cards.map((card) => {
          const label = t(card.key);
          return (
            <li
              key={card.key}
              data-testid={`kpi-${card.key}`}
              className="relative flex min-h-40 flex-col rounded-card border border-glass-line bg-glass p-4 shadow-glass backdrop-blur-xl backdrop-saturate-150 sm:p-5 md:min-h-44"
            >
              {/* The "open in Rezervări" arrow (Dashboard.kpi.open) returns with the Rezervări page. */}
              <h2 className="pt-1 text-sm leading-snug font-semibold text-ink-soft">{label}</h2>
              <p className="mt-auto pt-5 font-serif text-[2.4rem] leading-none tracking-tight text-ink tabular-nums sm:text-5xl">
                <span data-testid={`kpi-${card.key}-value`}>
                  {card.value}
                  {card.unit && <span className="text-[0.55em] text-ink-soft">{card.unit}</span>}
                </span>
              </p>
              {card.meter && <KpiLiveMeter base={base} label={label} />}
              <p className="mt-2.5 text-[13px] leading-snug text-ink-soft first-letter:uppercase">{card.hint}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function KpiSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <li
          key={i}
          className="flex min-h-40 flex-col rounded-card border border-glass-line bg-glass p-4 shadow-glass backdrop-blur-xl sm:p-5 md:min-h-44"
        >
          <div className="h-4 w-24 rounded-full bg-cream-100/80" />
          <div className="mt-auto h-10 w-20 rounded-xl bg-cream-100/80" />
          <div className="mt-3 h-3 w-28 rounded-full bg-cream-100/70" />
        </li>
      ))}
    </ul>
  );
}
