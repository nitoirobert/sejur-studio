"use client";

import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Unit } from "@/lib/mock-units";

// The published units, loaded on the server (src/lib/catalog/server.ts) and handed to the
// client components through this context.
const UnitsContext = createContext<Unit[]>([]);

export function UnitsProvider({ units, children }: { units: Unit[]; children: ReactNode }) {
  return createElement(UnitsContext.Provider, { value: units }, children);
}

// Units as stored (no translation): for counts, places and price limits.
export function useBaseUnits(): Unit[] {
  return useContext(UnitsContext);
}

// Names and descriptions come from the database (Romanian). A translation in
// messages/<lang>.json (UnitText.<id>) wins when it exists.
export function useLocalizeUnit() {
  const t = useTranslations("UnitText");
  return useMemo(() => {
    return (u: Unit): Unit =>
      t.has(`${u.id}.name`)
        ? { ...u, name: t(`${u.id}.name`), description: t(`${u.id}.description`) }
        : u;
  }, [t]);
}

// All units, in the current language
export function useUnits(): Unit[] {
  const units = useBaseUnits();
  const localize = useLocalizeUnit();
  return useMemo(() => units.map(localize), [units, localize]);
}
