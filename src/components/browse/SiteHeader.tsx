"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Heart, HousePlus, Phone, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { iconButton, pill, pillActive } from "@/components/ui/soft";
import { hostSignupUrl } from "@/lib/links";
import { spring } from "@/components/ui/motion";
import { StayBar } from "./StayBar";
import { LocationPicker } from "./LocationPicker";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";
import type { Stay } from "./PropertyBrowser";

type Props = {
  stay: Stay;
  onStayChange: (s: Stay) => void;
  query: string;
  onQueryChange: (q: string) => void;
  onOpenUnit: (id: string) => void;
  place: string | null;
  onPlaceChange: (p: string | null) => void;
  onFavorites: () => void;
  onLogin: () => void;
  onHome: () => void; // click pe logo sau pe „Sejur Studio" → pagina de start (grila cu 5 coloane)
};

// Antetul: logo | Favorite + bară de căutare + Locație (centru, ecrane ≥1536px) | contact + cont
export function SiteHeader({ place, onPlaceChange, onFavorites, onLogin, onHome, ...bar }: Props) {
  const t = useTranslations("Header");
  const tap = { whileHover: { y: -2 }, whileTap: { scale: 0.96 }, transition: spring };

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
        <motion.span whileHover={{ rotate: -8, scale: 1.05 }} transition={spring} className="shrink-0">
          <Image
            src="/logo.png"
            alt={t("brand")}
            width={128}
            height={128}
            priority
            className="size-14 rounded-full shadow-soft 2xl:size-[4.5rem]"
          />
        </motion.span>
        {/* Scris real (nu imagine): același font și stil ca titlul „Unități disponibile" */}
        <span className="font-brand text-2xl font-bold tracking-tight text-ink sm:text-3xl">{t("brand")}</span>
      </Link>

      {/* Centru (doar ≥1536px): Favorite – bară de căutare – Locație */}
      <nav className="mx-auto hidden shrink-0 items-center gap-3 2xl:flex">
        <motion.button
          {...tap}
          type="button"
          onClick={onFavorites}
          className={`${pill} h-14 gap-2.5 px-6 text-base font-semibold`}
        >
          <Heart className="size-5 text-accent" />
          {t("nav.favorites")}
        </motion.button>
        <StayBar {...bar} className="2xl:w-[26rem] min-[1800px]:w-[34rem]" />
        <LocationPicker value={place} onChange={onPlaceChange} size="lg" />
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2.5 2xl:ml-0">
        <ThemeToggle />
        <motion.a {...tap} href="tel:+40700000000" className={`${iconButton} size-12 max-sm:hidden`} aria-label={t("call")}>
          <Phone className="size-5" />
        </motion.a>
        <LanguageSwitcher />

        {/* Cont: autentificare + avatar (deschid popup-ul de login, deocamdată de fațadă) */}
        <span className="mx-1 h-8 w-px bg-sand-200 max-sm:hidden" aria-hidden />
        {/* Pentru proprietari: duce la crearea contului de gazdă (panoul de administrare).
            Pe telefon nu încape în antet; acolo linkul e în fereastra de autentificare. */}
        <a
          href={hostSignupUrl}
          className={`${pillActive} h-12 px-5 text-base max-lg:size-12 max-lg:justify-center max-lg:px-0 max-sm:hidden`}
          aria-label={t("hostSignup")}
        >
          <HousePlus className="size-5 shrink-0" />
          <span className="max-lg:hidden">{t("hostSignup")}</span>
        </a>
        <motion.button
          {...tap}
          type="button"
          onClick={onLogin}
          className={`${pill} h-12 px-6 text-base font-semibold max-sm:hidden`}
        >
          {t("login")}
        </motion.button>
        <motion.button
          {...tap}
          type="button"
          onClick={onLogin}
          className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-50 text-accent shadow-pill ring-2 ring-cream-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={t("account")}
        >
          <User className="size-6" />
        </motion.button>
      </div>
    </motion.header>
  );
}
