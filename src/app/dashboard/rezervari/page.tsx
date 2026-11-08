import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { ComingSoon, PanelSkeleton } from "@/components/dashboard/Placeholders";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard.pages.bookings");
  return { title: t("title") };
}

// The KPI arrows link here with ?filtru / ?zi / ?luna; the table and its filters come in step 8.
export default async function BookingsPage() {
  const t = await getTranslations("Dashboard.pages.bookings");
  return (
    <DashboardPage title={t("title")} subtitle={t("subtitle")} fallback={<PanelSkeleton />}>
      <ComingSoon icon={CalendarDays} title={t("emptyTitle")} body={t("emptyBody")} />
    </DashboardPage>
  );
}
