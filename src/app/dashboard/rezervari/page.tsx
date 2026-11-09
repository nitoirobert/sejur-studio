import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { ComingSoon, PanelSkeleton } from "@/components/dashboard/Placeholders";
import { PendingRequests } from "@/components/dashboard/requests/PendingRequests";
import { pageFromParam } from "@/components/dashboard/requests/codes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard.pages.bookings");
  return { title: t("title") };
}

// "De confirmat" (booking requests from the site, ?pagina=N) on top. The KPI arrows link here with
// ?filtru / ?zi / ?luna; the full table and its filters come in step 8.
export default async function BookingsPage({ searchParams }: PageProps<"/dashboard/rezervari">) {
  const t = await getTranslations("Dashboard.pages.bookings");
  return (
    <DashboardPage title={t("title")} subtitle={t("subtitle")} fallback={<PanelSkeleton />}>
      <Requests searchParams={searchParams} />
      <div className="mt-4 md:mt-5">
        <ComingSoon icon={CalendarDays} title={t("emptyTitle")} body={t("emptyBody")} />
      </div>
    </DashboardPage>
  );
}

// Inside DashboardPage's Suspense, after requireViewer().
async function Requests({ searchParams }: { searchParams: PageProps<"/dashboard/rezervari">["searchParams"] }) {
  const { pagina } = await searchParams;
  return <PendingRequests page={pageFromParam(pagina)} />;
}
