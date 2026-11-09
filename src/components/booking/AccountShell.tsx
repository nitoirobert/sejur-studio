import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { pill, pillActive } from "@/components/ui/soft";

// Frame of the guest account pages (/cont/rezervari, /cont/favorite): back link, title, two tabs.
export async function AccountShell({ active, children }: { active: "bookings" | "favorites"; children: ReactNode }) {
  const t = await getTranslations("Account");
  const tabs = [
    { key: "bookings", href: "/cont/rezervari", label: t("bookings") },
    { key: "favorites", href: "/cont/favorite", label: t("favorites") },
  ] as const;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col px-4 py-6 lg:py-10">
      <Link href="/" className={`${pill} self-start px-4 py-2.5`}>
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>
      <h1 className="mt-6 font-serif text-3xl text-ink">{t("title")}</h1>
      <nav aria-label={t("title")} className="mt-4 flex gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.key === active ? "page" : undefined}
            className={`${tab.key === active ? pillActive : pill} px-4 py-2`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </main>
  );
}
