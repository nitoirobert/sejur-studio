import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Account, AccountSkeleton } from "@/components/dashboard/Account";
import { DashboardNav } from "@/components/dashboard/Sidebar";
import { signOut } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard");
  return { title: { template: `%s · ${t("brand")}`, default: t("brand") }, robots: { index: false } };
}

// The shell renders without waiting for the session; user-specific parts stream in behind Suspense.
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <DashboardNav
      signOut={signOut}
      account={
        <Suspense fallback={<AccountSkeleton />}>
          <Account />
        </Suspense>
      }
    >
      {children}
    </DashboardNav>
  );
}
