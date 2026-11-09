"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { pill } from "@/components/ui/soft";
import { setLocale } from "@/i18n/actions";
import { localeNames, locales, type Locale } from "@/i18n/config";
import { useDismiss } from "./use-dismiss";

// Butonul de limbă (RO, EN, DE…) cu meniu. Alegerea se păstrează într-un cookie.
export function LanguageSwitcher() {
  const t = useTranslations("Header");
  const current = useLocale() as Locale;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const choose = (locale: Locale) => {
    setOpen(false);
    if (locale === current) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  };

  return (
    <div ref={ref} className="relative max-sm:hidden">
      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.96 }}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("language")}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${pill} h-12 px-5 text-base uppercase`}
      >
        {current}
      </motion.button>
      {open && (
        <ul
          role="listbox"
          aria-label={t("language")}
          className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl bg-cream-50 p-1.5 shadow-soft"
        >
          {locales.map((l) => (
            <li key={l} role="option" aria-selected={l === current}>
              <button
                type="button"
                lang={l}
                onClick={() => choose(l)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-accent-50"
              >
                {localeNames[l]}
                {l === current && <Check className="size-4 text-accent" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
