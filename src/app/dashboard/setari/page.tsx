import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { ComingSoon, PanelSkeleton } from "@/components/dashboard/Placeholders";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard.pages.settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const t = await getTranslations("Dashboard.pages.settings");
  return (
    <DashboardPage title={t("title")} subtitle={t("subtitle")} fallback={<PanelSkeleton />}>
      <ComingSoon icon={Settings} title={t("emptyTitle")} body={t("emptyBody")} />
    </DashboardPage>
  );
}
