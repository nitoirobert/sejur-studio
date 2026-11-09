import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireAccountUser } from "@/lib/account/server";
import { AccountCard, accountSkeleton } from "@/components/account/AccountCards";
import { NotificationSettings } from "@/components/account/NotificationSettings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("notify.title"), robots: { index: false } };
}

export default function NotificationsPage() {
  return (
    <>
      <Suspense fallback={accountSkeleton}>
        <Notifications />
      </Suspense>
    </>
  );
}

async function Notifications() {
  const user = await requireAccountUser("/cont/notificari");
  const t = await getTranslations("Account.notify");
  return (
    <AccountCard title={t("sub")}>
      <NotificationSettings email={user.email} initial={user.notify} />
    </AccountCard>
  );
}
