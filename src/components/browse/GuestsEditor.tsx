"use client";

import { Baby, Minus, Plus, User, Users, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { LIMITS, occupancy, type GuestCounts } from "@/lib/guests";

type Props = {
  value: GuestCounts;
  onChange: (v: GuestCounts) => void;
  capacity?: number; // capacitatea unității (în panou); fără ea, doar limitele generale
  compact?: boolean;
};

/*
  Editor de oaspeți: 3 rânduri cu minus / plus.
  - Adulți (peste 5 ani) – minim 1
  - Copii (2–5 ani) – ocupă loc
  - Bebeluși (0–2 ani) – nu ocupă loc
*/
export function GuestsEditor({ value, onChange, capacity, compact }: Props) {
  const t = useTranslations("Guests");
  const full = capacity !== undefined && occupancy(value) >= capacity;

  const rows: { key: keyof GuestCounts; icon: LucideIcon; counts: boolean }[] = [
    { key: "guests", icon: User, counts: true },
    { key: "kids", icon: Users, counts: true },
    { key: "infants", icon: Baby, counts: false },
  ];

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {rows.map(({ key, icon: Icon, counts }) => {
        const { min, max } = LIMITS[key];
        const v = value[key];
        const label = t(key);
        const canAdd = v < max && !(counts && full);
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cream-50 text-accent shadow-pill">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{label}</span>
              <span className="block truncate text-xs text-muted">{t(`${key}Hint`)}</span>
            </span>
            <div className="flex items-center gap-2.5">
              <motion.button
                whileTap={{ scale: 0.88 }}
                type="button"
                disabled={v <= min}
                onClick={() => onChange({ ...value, [key]: v - 1 })}
                className="grid size-8 place-items-center rounded-full bg-cream-50 shadow-pill disabled:opacity-40"
                aria-label={t("fewer", { label })}
              >
                <Minus className="size-3.5" />
              </motion.button>
              <span className="w-5 text-center text-base font-bold tabular-nums" aria-live="polite">
                {v}
              </span>
              <motion.button
                whileTap={{ scale: 0.88 }}
                type="button"
                disabled={!canAdd}
                onClick={() => onChange({ ...value, [key]: v + 1 })}
                className="grid size-8 place-items-center rounded-full bg-cream-50 shadow-pill disabled:opacity-40"
                aria-label={t("more", { label })}
              >
                <Plus className="size-3.5" />
              </motion.button>
            </div>
          </div>
        );
      })}
      {capacity !== undefined && (
        <p className={`text-xs ${full ? "text-accent" : "text-muted"}`}>{t("capacity", { count: capacity })}</p>
      )}
    </div>
  );
}

// Text scurt: „2 adulți, 1 copil, 1 bebeluș"
export function useGuestsSummary() {
  const t = useTranslations("Guests");
  return (g: GuestCounts) =>
    [
      t("adultsCount", { count: g.guests }),
      g.kids ? t("kidsCount", { count: g.kids }) : null,
      g.infants ? t("infantsCount", { count: g.infants }) : null,
    ]
      .filter(Boolean)
      .join(", ");
}
