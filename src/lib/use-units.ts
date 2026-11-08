"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { units, type Unit } from "@/lib/mock-units";

// Numele și descrierea fiecărei cazări vin din messages/<limbă>.json (UnitText.<id>),
// ca să urmeze limba aleasă pe site. Restul datelor (preț, poze, coordonate) nu depind de limbă.
// Când datele vor veni din Supabase, traducerile vor sta într-o coloană per limbă.

export function useLocalizeUnit() {
  const t = useTranslations("UnitText");
  return useMemo(() => {
    return (u: Unit): Unit =>
      t.has(`${u.id}.name`)
        ? { ...u, name: t(`${u.id}.name`), description: t(`${u.id}.description`) }
        : u;
  }, [t]);
}

// Toate cazările, în limba curentă
export function useUnits(): Unit[] {
  const localize = useLocalizeUnit();
  return useMemo(() => units.map(localize), [localize]);
}
