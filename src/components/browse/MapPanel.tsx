"use client";

import { useMemo } from "react";
import { ChevronRight, MapPin, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { nightly, photoThumb, type MappedUnit as Unit } from "@/lib/mock-units";
import { usePrice } from "./use-price";

/*
  Panoul din stânga hărții.
  - Nicio zonă aleasă: lista județelor în care avem cazări (cu numărul lor); click = harta zboară în județ.
  - Județ ales: cazările din acel județ (aceleași ca pe hartă, după filtre); click = se deschide panoul cazării.
  Lista vine gata filtrată din PropertyBrowser, deci panoul și harta arată mereu aceleași cazări.
*/

const countyOf = (u: Unit) => u.location.split(",")[1]?.trim() || u.location.trim();
const cityOf = (u: Unit) => u.location.split(",")[0]?.trim() ?? "";

type Props = {
  units: Unit[];
  county: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCountySelect: (county: string | null) => void;
};

export function MapPanel({ units, county, selectedId, onSelect, onCountySelect }: Props) {
  const t = useTranslations("Map");
  const tUnit = useTranslations("Unit");
  const price = usePrice();
  const inCounty = useMemo(
    () => (county ? units.filter((u) => countyOf(u) === county) : []),
    [units, county],
  );
  const shown = inCounty;

  const counties = useMemo(() => {
    const by = new globalThis.Map<string, Unit[]>();
    for (const u of units) {
      const c = countyOf(u);
      if (c) by.set(c, [...(by.get(c) ?? []), u]);
    }
    return [...by.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "ro"));
  }, [units]);
  const shownCounties = counties;

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-serif text-lg text-ink">{county ?? t("panelCounties")}</h2>
          <span className="text-xs text-ink-soft">{t("stays", { count: county ? inCounty.length : units.length })}</span>
        </div>
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-sand-200 overflow-y-auto px-2 pb-2">
        {county
          ? shown.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => onSelect(u.id)}
                  aria-current={u.id === selectedId}
                  className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-cream-100 ${
                    u.id === selectedId ? "bg-cream-100 ring-1 ring-accent/40" : ""
                  }`}
                >
                  <Thumb src={u.photos[0]} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-xs text-ink-soft">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{cityOf(u)}</span>
                    </span>
                    <span className="block truncate text-sm font-semibold text-ink">{u.name}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
                      {u.rating !== null && (
                        <span className="inline-flex items-center gap-1">
                          <Star className="size-3 fill-star text-star" />
                          {u.rating.toFixed(1)}
                        </span>
                      )}
                      <span className="font-semibold text-ink">{price(nightly(u))}</span>
                      <span>{tUnit("perNight")}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))
          : shownCounties.map(([name, list]) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => onCountySelect(name)}
                  className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-cream-100"
                >
                  <Thumb src={list.find((x) => x.photos[0])?.photos[0]} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{name}</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">{t("stays", { count: list.length })}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-ink-soft" />
                </button>
              </li>
            ))}
        {(county ? shown.length : shownCounties.length) === 0 && (
          <li className="px-3 py-8 text-center text-sm text-ink-soft">{t("panelEmpty")}</li>
        )}
      </ul>
    </div>
  );
}

// Small thumbnail; a stay without photos (or a broken link) gets a neutral tile instead of a broken image.
function Thumb({ src }: { src: string | undefined }) {
  const empty = <span className="size-16 shrink-0 rounded-xl bg-cream-200 shadow-pressed" aria-hidden />;
  if (!src) return empty;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small catalogue thumbnail
    <img
      src={photoThumb(src, 240)}
      alt=""
      loading="lazy"
      className="size-16 shrink-0 rounded-xl bg-cream-200 object-cover"
      onError={(e) => (e.currentTarget.style.visibility = "hidden")}
    />
  );
}
