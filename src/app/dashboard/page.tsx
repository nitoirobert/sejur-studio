import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { KpiCards, KpiSkeleton } from "@/components/dashboard/KpiCards";
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
    <DashboardPage
      title={t("title")}
      subtitle={t("subtitle")}
      ownHeader
      fallback={
        <>
          <OverviewTop header={<PageHeader title={t("title")} subtitle={t("subtitle")} />} below={<KpiSkeleton />} />
          <OverviewSkeleton withoutKpis />
        </>
      }
    >
      <Overview searchParams={searchParams} header={<PageHeader title={t("title")} subtitle={t("subtitle")} />} />
    </DashboardPage>
  );
}

// Inside DashboardPage's Suspense, after requireViewer().
async function Overview({ searchParams, header }: { searchParams: PageProps<"/dashboard">["searchParams"]; header: React.ReactNode }) {
  const { unitsTotal, ...chart } = await loadChart(await searchParams);
  return (
    <OverviewProvider today={chart.today} unitsTotal={unitsTotal}>
      <OverviewTop header={header} below={<KpiCards />} />
      <BookingChart data={chart} />
    </OverviewProvider>
  );
}

// Title ("Prezentare") and the 4 KPI cards: one row on wide screens (2xl), stacked below that.
function OverviewTop({ header, below }: { header: React.ReactNode; below: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-7 md:gap-9 2xl:flex-row 2xl:items-center 2xl:gap-4">
      <div className="2xl:shrink-0">{header}</div>
      <div className="min-w-0 2xl:flex-1">{below}</div>
    </div>
  );
}
