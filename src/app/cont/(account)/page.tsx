import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireAccountUser } from "@/lib/account/server";
import { AccountBlock, accountSkeleton } from "@/components/account/AccountCards";
import { card } from "@/components/ui/soft";
import { AvatarEditor } from "@/components/account/AvatarEditor";
import { PersonalForm } from "@/components/account/PersonalForm";
import { AccountActions, EmailForm, PasswordForm } from "@/components/account/SecurityForms";
import { AccountOverview } from "@/components/account/AccountOverview";

// Profile of any signed-in account (guest or host): picture, personal data, email, password, sign out
// and account deletion. On wide screens a second column sums up the account (completeness, activity,
// next stay).

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("profileTitle"), robots: { index: false } };
}

export default function ProfilePage() {
  return (
    <>
      <Suspense fallback={accountSkeleton}>
        <Profile />
      </Suspense>
    </>
  );
}

async function Profile() {
  const user = await requireAccountUser("/cont");
  const t = await getTranslations("Account");
  const tAuth = await getTranslations("Auth.account");
  const initial = (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className={`${card} space-y-8 p-5 sm:p-6`}>
        <AccountBlock title={t("profileTitle")} sub={user.isHost ? `${tAuth("host")} · ${t("personal.hostAlsoGuest")}` : tAuth("guest")}>
          <div className="space-y-5">
            <AvatarEditor userId={user.id} initial={initial} avatarUrl={user.avatarUrl} />
            <PersonalForm name={user.name} phone={user.phone} />
          </div>
        </AccountBlock>
        <AccountBlock title={t("security")}>
          <div className="space-y-5">
            <EmailForm email={user.email} pendingEmail={user.pendingEmail} />
            <PasswordForm hasPassword={user.hasPassword} />
          </div>
        </AccountBlock>
        <AccountBlock title={t("danger.section")}>
          <AccountActions userId={user.id} email={user.email} isHost={user.isHost} />
        </AccountBlock>
      </div>
      <Suspense fallback={accountSkeleton}>
        <AccountOverview user={user} />
      </Suspense>
    </div>
  );
}
