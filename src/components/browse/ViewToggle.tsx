"use client";

import { Grid2x2, Grid3x3, List, Map as MapIcon, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { spring } from "@/components/ui/motion";

export type ViewMode = "grid3" | "grid5" | "list" | "map";

const layouts: { id: ViewMode; icon: LucideIcon }[] = [
  { id: "grid3", icon: Grid2x2 },
  { id: "grid5", icon: Grid3x3 },
  { id: "list", icon: List },
];

// Comutator de afișare: harta ca buton propriu, urmată de cele 3 așezări ale listei
// (3 coloane / 5 coloane / listă) într-un grup. Indicatorul alunecă între ele.
export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const t = useTranslations("View");
  const map = value === "map";

  return (
    <div role="group" aria-label={t("label")} className="flex items-center gap-2">
      <div className="flex rounded-full bg-cream-100 p-1 shadow-pressed">
        <button
          type="button"
          aria-pressed={map}
          aria-label={t("map")}
          title={t("map")}
          onClick={() => onChange("map")}
          className={`relative flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors ${
            map ? "text-cream-50" : "text-ink-soft hover:text-ink"
          }`}
        >
          {map && (
            <motion.span layoutId="view-toggle" transition={spring} className="absolute inset-0 rounded-full bg-accent shadow-accent" />
          )}
          <MapIcon className="relative size-4" />
          <span className="relative max-sm:sr-only">{t("map")}</span>
        </button>
      </div>

      <div className="flex rounded-full bg-cream-100 p-1 shadow-pressed">
        {layouts.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            aria-label={t(id)}
            title={t(id)}
            onClick={() => onChange(id)}
            className={`relative grid size-9 place-items-center rounded-full transition-colors ${
              value === id ? "text-cream-50" : "text-ink-soft hover:text-ink"
            }`}
          >
            {value === id && (
              <motion.span layoutId="view-toggle" transition={spring} className="absolute inset-0 rounded-full bg-accent shadow-accent" />
            )}
            <Icon className="relative size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
