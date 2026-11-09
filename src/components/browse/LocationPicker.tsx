"use client";

import { History, MapPin, Navigation, X } from "lucide-react";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { pill } from "@/components/ui/soft";
import { popover } from "@/components/ui/motion";
import { suggestPlaces, usePlaces, type Place } from "@/lib/search/catalog";
import { rankRecent, recordRecent, useRecent } from "@/lib/search/recent";
import { Autocomplete, type AcGroup, type AcItem } from "./Autocomplete";
import { useDismiss } from "./use-dismiss";

type Props = {
  value: string | null; // ex. „Bran, Brașov"
  onChange: (place: string | null) => void;
  size?: "md" | "lg";
  className?: string;
};

// Butonul „Locație": scrii unde vrei să mergi, ca într-un navigator, cu sugestii pe măsură ce tastezi
export function LocationPicker({ value, onChange, size = "md", className = "" }: Props) {
  const t = useTranslations("Location");
  const tSearch = useTranslations("Search");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [now, setNow] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const recent = useRecent("location");
  const { places, sitePlaces } = usePlaces();

  useDismiss(ref, open, () => setOpen(false));

  const pick = (p: Place) => {
    onChange(p.label);
    recordRecent("location", p.label);
    setOpen(false);
  };

  const toItem = (p: Place, icon = MapPin): AcItem => ({
    id: p.label,
    label: p.city,
    sublabel: p.county,
    meta: p.count > 0 ? tSearch("unitsCount", { count: p.count }) : t("noUnits"),
    icon,
    onPick: () => pick(p),
  });

  const suggestions = text.trim() ? suggestPlaces(text, recent, now, 7, places) : [];
  const groups: AcGroup[] = text.trim()
    ? [{ id: "results", title: t("results"), items: suggestions.map((p) => toItem(p)) }]
    : [
        {
          id: "recent",
          title: t("recent"),
          items: rankRecent(recent, now, 4)
            .map((r) => places.find((p) => p.label === r.q))
            .filter((p): p is Place => !!p)
            .map((p) => toItem(p, History)),
        },
        { id: "site", title: t("onSite"), items: sitePlaces.map((p) => toItem(p)) },
      ];

  const city = value?.split(",")[0];
  const lg = size === "lg";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div
        className={`${pill} w-full justify-center ${lg ? "h-14 text-base" : "h-12"} ${
          value ? "ring-2 ring-accent/30" : ""
        }`}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
            setText("");
            setNow(Date.now());
          }}
          className={`flex h-full items-center gap-2 font-semibold ${lg ? "pl-5" : "pl-4"} ${
            value ? "pr-1 text-ink" : lg ? "pr-5 text-ink-soft" : "pr-4 text-ink-soft"
          }`}
          aria-label={value ? t("change", { place: value }) : t("button")}
        >
          <MapPin className={`shrink-0 text-accent ${lg ? "size-5" : "size-4"}`} />
          <span className={value ? "max-w-[9rem] truncate" : ""}>
            {city ?? t("button")}
          </span>
        </button>
        <AnimatePresence>
          {value && (
            <motion.button
              type="button"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => onChange(null)}
              aria-label={t("clear")}
              className={`grid size-6 place-items-center rounded-full bg-cream-100 text-ink-soft hover:text-ink ${lg ? "mr-4" : "mr-3"}`}
            >
              <X className="size-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={t("title")}
            variants={popover}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: "top right" }}
            className="absolute top-full right-0 z-40 mt-3 w-[min(24rem,calc(100vw-2rem))] rounded-card bg-cream-50 p-4 shadow-soft ring-1 ring-sand"
          >
            <p className="flex items-center gap-2 px-1 font-serif text-xl">
              <Navigation className="size-4 text-accent" />
              {t("title")}
            </p>
            <Autocomplete
              inline
              autoFocus
              className="mt-3"
              fieldClassName="flex items-center gap-2 rounded-2xl bg-cream-100 px-4 py-3 shadow-pressed focus-within:ring-2 focus-within:ring-accent/40"
              value={text}
              onChange={setText}
              onSubmit={() => suggestions[0] && pick(suggestions[0])}
              groups={groups}
              completions={[...suggestions.map((p) => p.city), ...places.map((p) => p.city)]}
              ariaLabel={t("title")}
              placeholder={<span className="text-muted">{t("placeholder")}</span>}
              focusedPlaceholder={t("placeholder")}
              hint={text && suggestions.length === 0 ? t("none", { query: text }) : tSearch("hint")}
              leading={<MapPin className="size-4 shrink-0 text-ink-soft" />}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
