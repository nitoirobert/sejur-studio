import { createClient } from "@/lib/supabase/server";
import { chartWindow, parseChartParams } from "@/lib/dates/chart-params";
import { loadKpis } from "../KpiCards";
import type { ChartData, ChartProperty } from "./types";

type Raw = Record<string, string | string[] | undefined>;

/*
  Server-side data for the bookings chart. Per navigation: 1 units query + 1 dashboard_chart call
  (dashboard_kpis is shared with the KPI cards through React cache()). "Today" comes from
  bucharest_today(), run in parallel with the KPIs and the units: the browser's time zone never
  decides it and the chart never waits for the KPIs.
  Every query runs as the signed-in owner, so RLS limits it to their organization.
*/
export async function loadChart(raw: Raw): Promise<ChartData & { unitsTotal: number }> {
  const supabase = await createClient();
  const unitsQuery = supabase
    .from("units")
    .select("id, name, position, property_id, properties(id, name)")
    .order("position")
    .order("name")
    .limit(500);

  const chartQuery = (async () => {
    const day = await supabase.rpc("bucharest_today");
    if (day.error || !day.data) throw new Error("bucharest_today failed");
    const today = day.data;
    const params = parseChartParams(raw, today);
    const { from, to } = chartWindow(params);
    const chart = await supabase.rpc("dashboard_chart", {
      p_from: from,
      p_to: to,
      p_property_id: params.property ?? undefined,
    });
    if (chart.error) throw new Error("dashboard_chart failed");
    return { today, params, from, chart };
  })();

  // Properties on their own too: one without units yet still belongs in the filter (brief 04).
  const propertiesQuery = supabase.from("properties").select("id, name").limit(500);

  const [, units, { today, params, from, chart }, props] = await Promise.all([
    loadKpis(),
    unitsQuery,
    chartQuery,
    propertiesQuery,
  ]);
  if (units.error) throw new Error("units query failed");
  if (props.error) throw new Error("properties query failed");

  // Group units under their property; properties sorted by name (ro collation).
  const byProperty = new Map<string, ChartProperty>();
  for (const u of units.data) {
    const prop = u.properties;
    let group = byProperty.get(u.property_id);
    if (!group) {
      group = { id: u.property_id, name: prop?.name ?? "", units: [] };
      byProperty.set(u.property_id, group);
    }
    group.units.push({ id: u.id, name: u.name, propertyId: u.property_id });
  }
  const all = [...byProperty.values()].sort((a, b) => a.name.localeCompare(b.name, "ro"));
  const properties = params.property ? all.filter((p) => p.id === params.property) : all;
  const filterOptions = props.data
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ro"));

  return {
    today,
    from,
    days: params.days,
    property: params.property,
    properties,
    allProperties: filterOptions,
    unitsTotal: units.data.length,
    bookings: (chart.data ?? []).map((r) => ({
      id: r.booking_id,
      unitId: r.unit_id,
      propertyId: r.property_id,
      checkIn: r.check_in,
      checkOut: r.check_out,
      status: r.status,
      source: r.source,
      guestName: r.guest_name,
      adults: r.adults,
      children: r.children,
      totalAmount: r.total_amount,
      currency: r.currency,
      holdExpiresAt: r.hold_expires_at,
    })),
  };
}
