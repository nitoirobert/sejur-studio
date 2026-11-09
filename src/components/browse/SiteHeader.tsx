"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { House, HousePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { pill, pillActive } from "@/components/ui/soft";
import { hostDashboardUrl, hostSignupUrl } from "@/lib/links";
import { useAccount } from "@/lib/use-host-session";
import { spring } from "@/components/ui/motion";
import { StayBar } from "./StayBar";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";
import type { Stay } from "./PropertyBrowser";

type Props = {
  stay: Stay;
  onStayChange: (s: Stay) => void;
  query: string;
  onQueryChange: (q: string) => void;
  onOpenUnit: (id: string) => void;
  onLogin: () => void;
  onHome: () => void; // click pe logo sau pe „Sejur Studio" → pagina de start (grila cu 5 coloane)
};

// Antetul: logo | bară de căutare (centru, ecrane ≥1536px) | temă, limbă, cont
export function SiteHeader({
  onLogin,
  onHome,
  ...bar
}: Props) {
  const t = useTranslations("Header");
  // Cine e logat (doar pentru afișare). Gazdă: „Contul tău de gazdă" duce în panou.
  // Client: butonul de gazdă dispare, iar în locul lui „Autentificare" apare numele lui.
  const account = useAccount();
  const hostSignedIn = account?.kind === "host";
  const firstName =
    (account?.name ?? account?.email ?? "").trim().split(/[\s@]+/)[0] || null;
  // Logat: profilul are pagina lui (/cont). Delogat: popup-ul de autentificare.
  const router = useRouter();
  const openAccount = () => (account ? router.push("/cont") : onLogin());
  const hostLabel = t(hostSignedIn ? "hostAccount" : "hostSignup");
  const HostIcon = hostSignedIn ? House : HousePlus;
  const tap = {
    whileHover: { y: -2 },
    whileTap: { scale: 0.96 },
    transition: spring,
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -16, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 200, damping: 26 }}
      className="relative z-30 flex items-center gap-4 py-6 2xl:py-8"
    >
      <Link
        href="/"
        onClick={(e) => {
          e.preventDefault();
          onHome();
        }}
        className="flex shrink-0 items-center gap-3 2xl:gap-4"
        aria-label={t("home")}
      >
        <motion.span whileHover={{ scale: 1.04 }} transition={spring} className="shrink-0">
          <Image
            src="/logo-wordmark-v2.png"
            alt={t("brand")}
            width={900}
            height={208}
            priority
            className="h-12 w-auto 2xl:h-16"
          />
        </motion.span>
      </Link>

      {/* Centru (doar ≥1536px): bara de căutare, lată cât să încapă textul de exemplu întreg */}
      <nav className="mx-auto hidden min-w-0 flex-1 justify-center px-4 2xl:flex">
        <StayBar {...bar} size="lg" className="w-full max-w-[52rem]" />
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2.5 2xl:ml-0">
        <ThemeToggle />
        <LanguageSwitcher />

        {/* Cont: autentificare + avatar (deschid popup-ul de cont) */}
        <span className="mx-1 h-8 w-px bg-sand-200 max-sm:hidden" aria-hidden />
        {/* Pentru proprietari: duce la crearea contului de gazdă (panoul de administrare).
            Pe telefon nu încape în antet; acolo linkul e în fereastra de autentificare. */}
        {account?.kind !== "guest" && (
          <a
            href={hostSignedIn ? hostDashboardUrl : hostSignupUrl}
            className={`${pillActive} h-12 px-5 text-base max-lg:size-12 max-lg:justify-center max-lg:px-0 max-sm:hidden`}
            aria-label={hostLabel}
          >
            <HostIcon className="size-5 shrink-0" />
            <span className="max-lg:hidden">{hostLabel}</span>
          </a>
        )}
        {/* „Autentificare" doar când nu ești logat; logat, rămâne doar avatarul. */}
        {!firstName && (
          <motion.button
            {...tap}
            type="button"
            onClick={onLogin}
            className={`${pill} h-12 max-w-48 px-6 text-base font-semibold`}
          >
            <span className="truncate">{t("login")}</span>
          </motion.button>
        )}
        {firstName && (
          <motion.button
            {...tap}
            type="button"
            onClick={openAccount}
            className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-50 text-accent shadow-pill ring-2 ring-cream-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={t("account")}
          >
            {account?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external avatar URL (Supabase / Google)
              <img src={account.avatarUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-lg font-bold">
                {firstName.charAt(0).toUpperCase()}
              </span>
            )}
          </motion.button>
        )}
      </div>
    </motion.header>
  );
}
