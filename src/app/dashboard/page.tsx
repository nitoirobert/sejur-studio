import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { OverviewSkeleton } from "@/components/dashboard/Placeholders";
import { OverviewProvider } from "@/components/dashboard/booking/OverviewProvider";
import { BookingChart } from "@/components/dashboard/chart/BookingChart";
import { loadChart } from "@/components/dashboard/chart/load";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard.pages.overview");
  return { title: t("title") };
}

// URL state of the chart: ?de=YYYY-MM-DD&zile=7|14|30&proprietate=<uuid> (lib/dates/chart-params.ts).
export default async function OverviewPage({ searchParams }: PageProps<"/dashboard">) {
  const t = await getTranslations("Dashboard.pages.overview");
  return (
    <DashboardPage title={t("title")} subtitle={t("subtitle")} fallback={<OverviewSkeleton />}>
      <Overview searchParams={searchParams} />
    </DashboardPage>
  );
}

// Inside DashboardPage's Suspense, after requireViewer().
async function Overview({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const { unitsTotal, ...chart } = await loadChart(await searchParams);
  return (
    <OverviewProvider today={chart.today} unitsTotal={unitsTotal}>
      <KpiCards />
      <BookingChart data={chart} />
    </OverviewProvider>
  );
}
