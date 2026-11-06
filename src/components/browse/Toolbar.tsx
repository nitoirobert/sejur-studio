"use client";

import { motion } from "motion/react";
import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Stay } from "./PropertyBrowser";
import { pill } from "@/components/ui/soft";
import { StayBar } from "./StayBar";
import { LocationPicker } from "./LocationPicker";

type Props = {
  onOpenFilters: () => void;
  activeFilterCount: number;
  stay: Stay;
  onStayChange: (s: Stay) => void;
  query: string;
  onQueryChange: (q: string) => void;
  onOpenUnit: (id: string) => void;
  place: string | null;
  onPlaceChange: (p: string | null) => void;
};

/*
  Rând sub antet, doar sub 1536px (pe ecrane late bara e în antet).
  Pe telefon: bara pe tot rândul, dedesubt Locație + Filtre.
  Butonul „Filtre" doar sub 1280px (peste, filtrele sunt în stânga).
*/
export function Toolbar({ onOpenFilters, activeFilterCount, place, onPlaceChange, ...bar }: Props) {
  const t = useTranslations("Toolbar");

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.05 }}
      className="relative z-20 flex flex-wrap items-center gap-2 pb-5 2xl:hidden"
    >
      <StayBar {...bar} className="min-w-0 basis-full sm:basis-0 sm:flex-1" />
      <LocationPicker value={place} onChange={onPlaceChange} className="max-sm:flex-1" />
      <button
        type="button"
        onClick={onOpenFilters}
        className={`${pill} relative h-12 justify-center px-4 max-sm:flex-1 xl:hidden`}
      >
        <SlidersHorizontal className="size-4" />
        {t("filters")}
        {activeFilterCount > 0 && (
          <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-cream-50">
            {activeFilterCount}
          </span>
        )}
      </button>
    </motion.div>
  );
}
