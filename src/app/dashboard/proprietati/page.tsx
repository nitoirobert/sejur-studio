import type { Metadata } from "next";
import { Home } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { ComingSoon, PanelSkeleton } from "@/components/dashboard/Placeholders";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard.pages.properties");
  return { title: t("title") };
}

export default async function PropertiesPage() {
  const t = await getTranslations("Dashboard.pages.properties");
  return (
    <DashboardPage title={t("title")} subtitle={t("subtitle")} fallback={<PanelSkeleton />}>
      <ComingSoon icon={Home} title={t("emptyTitle")} body={t("emptyBody")} />
    </DashboardPage>
  );
}
