import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getAccountUser } from "@/lib/account/server";
import { pill } from "@/components/ui/soft";
import { AccountNav, AccountTitle } from "@/components/account/AccountNav";

/*
  Frame shared by the account sections (/cont, /cont/rezervari, ...). Being a layout, it stays mounted
  while you switch sections: the menu does not reload or move. Guests and hosts alike (a host
  booking a stay is a guest too); hosts also get the gold link to their panel.
  - Desktop: side menu kept in the vertical middle of the screen; content centred on the right.
  - Phones / tablets: back link and a scrolling row of sections above the content.
*/
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("Account");
  return (
    <main className="flex w-full gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:py-0 2xl:px-8">
      <aside className="sticky top-0 hidden h-dvh shrink-0 items-center lg:flex">
        <Suspense fallback={<AccountNav variant="rail" isHost={null} />}>
          <Nav variant="rail" />
        </Suspense>
      </aside>

      <div className="mx-auto flex w-full max-w-[74rem] min-w-0 flex-1 flex-col lg:py-8">
        <div className="space-y-6 lg:hidden">
          <Link href="/" className={`${pill} px-4 py-2.5`}>
            <ArrowLeft className="size-4" />
            {t("back")}
          </Link>
          <Suspense fallback={<AccountNav variant="row" isHost={null} />}>
            <Nav variant="row" />
          </Suspense>
        </div>
        <div className="mt-6 lg:mt-1">
          <AccountTitle />
        </div>
        <div className="mt-6 min-w-0">{children}</div>
      </div>
    </main>
  );
}

async function Nav({ variant }: { variant: "rail" | "row" }) {
  const user = await getAccountUser();
  return <AccountNav variant={variant} isHost={!!user?.isHost} />;
}
