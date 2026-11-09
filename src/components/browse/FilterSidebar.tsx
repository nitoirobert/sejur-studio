"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BedDouble,
  Check,
  ChevronDown,
  House,
  MapPin,
  Users,
  Sparkles,
  Star,
  Tag,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { Unit } from "@/lib/mock-units";
import { useBaseUnits } from "@/lib/use-units";
import { usePlaces } from "@/lib/search/catalog";
import { card, iconButton } from "@/components/ui/soft";
import { spring } from "@/components/ui/motion";
import { usePrice } from "./use-price";
import { GuestsEditor, useGuestsSummary } from "./GuestsEditor";
import { occupancy } from "@/lib/guests";
import type { Stay } from "./PropertyBrowser";
import { amenityIcons, typeIcons } from "./icons";
import {
  PRICE_STEP,
  allAmenities,
  countActive,
  priceHistogram,
  priceLimits,
  ratingOptions,
  roomOptions,
  toggle,
  unitTypes,
  type Filters,
} from "./filters";

type Props = {
  filters: Filters;
  onChange: (f: Filters) => void;
  onClear: () => void;
  onClose?: () => void; // doar în varianta „sertar" de pe ecrane mici
  resultCount: number;
  place: string | null; // „Constanța" (județ) sau „Saturn, Constanța" (localitate)
  onPlaceChange: (p: string | null) => void;
  stay: Stay; // oaspeții (aceiași ca în bara de sus)
  onStayChange: (s: Stay) => void;
};

// Câte unități are fiecare opțiune (afișat lângă opțiune), din unitățile de pe pagină
function filterStats(units: Unit[]) {
  const histogram = priceHistogram(units);
  return {
    ...priceLimits(units),
    typeCounts: Object.fromEntries(unitTypes.map((t) => [t, units.filter((u) => u.type === t).length])),
    amenityCounts: Object.fromEntries(allAmenities.map((a) => [a, units.filter((u) => u.amenities.includes(a)).length])),
    offerCount: units.filter((u) => u.offer).length,
    histogram,
    maxBin: Math.max(1, ...histogram.map((b) => b.count)),
  };
}

export function FilterSidebar({ filters, onChange, onClear, onClose, resultCount, place, onPlaceChange, stay, onStayChange }: Props) {
  const t = useTranslations("Filters");
  const tUnit = useTranslations("Unit");
  const tAmenity = useTranslations("Amenities");
  const price = usePrice();
  const guestsSummary = useGuestsSummary();
  const tGuests = useTranslations("Guests");
  const units = useBaseUnits();
  const { PRICE_MIN, PRICE_MAX, priceShortcuts, typeCounts, amenityCounts, offerCount, histogram, maxBin } = useMemo(
    () => filterStats(units),
    [units],
  );
  const { siteCounties } = usePlaces();
  const active = countActive(filters) + (place ? 1 : 0);
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const [lo, hi] = filters.price ?? [PRICE_MIN, PRICE_MAX];
  const setPrice = (a: number, b: number) =>
    set({ price: a <= PRICE_MIN && b >= PRICE_MAX ? null : [a, b] });

  return (
    <div className={`${card} flex h-full flex-col overflow-hidden`}>
      {/* Antet */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <h2 className="font-serif text-2xl">{t("title")}</h2>
          <AnimatePresence>
            {active > 0 && (
              <motion.span
                key={active}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={spring}
                className="grid size-6 place-items-center rounded-full bg-accent text-xs font-bold text-cream-50"
              >
                {active}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className={iconButton} aria-label={t("close")}>
            <X className="size-4" />
          </button>
        ) : (
          active > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              {t("clear")}
            </button>
          )
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {/* Oferte – comutator vizibil sus */}
        <button
          type="button"
          role="switch"
          aria-checked={filters.onlyOffers}
          onClick={() => set({ onlyOffers: !filters.onlyOffers })}
          className={`flex w-full items-center gap-3 rounded-inner p-3.5 text-left transition-colors ${
            filters.onlyOffers ? "bg-star/25 ring-1 ring-star" : "bg-cream-100 shadow-pressed"
          }`}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-star text-ink shadow-pill">
            <Tag className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">{t("offers.title")}</span>
            <span className="block text-xs text-muted">{t("offers.hint", { count: offerCount })}</span>
          </span>
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              filters.onlyOffers ? "bg-accent" : "bg-sand-200"
            }`}
          >
            <motion.span
              layout
              transition={spring}
              className={`absolute top-0.5 size-5 rounded-full bg-cream-50 shadow-pill ${
                filters.onlyOffers ? "right-0.5" : "left-0.5"
              }`}
            />
          </span>
        </button>

        {/* Număr de persoane – aceleași valori ca în bara de sus; filtrează după capacitate */}
        <Section icon={Users} title={tGuests("filterTitle")} summary={guestsSummary(stay)}>
          <GuestsEditor value={stay} onChange={(g) => onStayChange({ ...stay, ...g })} compact />
          <p className="text-xs text-muted">{tGuests("filterHint", { count: occupancy(stay) })}</p>
        </Section>

        {/* Locație – acces rapid: județe, apoi localitățile din județul ales */}
        <Section
          icon={MapPin}
          title={t("location.title")}
          summary={place ? place.split(",")[0] : t("location.anywhere")}
        >
          <p className="text-xs font-medium text-ink-soft">{t("location.counties")}</p>
          <div className="grid grid-cols-2 gap-2">
            {siteCounties.map(({ county, count }) => {
              const on = place === county || (!!place && place.endsWith(`, ${county}`));
              return (
                <motion.button
                  key={county}
                  type="button"
                  aria-pressed={place === county}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onPlaceChange(place === county ? null : county)}
                  className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-colors ${
                    place === county
                      ? "bg-accent text-cream-50 shadow-accent"
                      : on
                        ? "bg-accent-50 text-accent ring-1 ring-accent/40"
                        : "bg-cream-50 text-ink shadow-pill hover:bg-cream-100"
                  }`}
                >
                  <span className="text-sm font-semibold">{county}</span>
                  <span className={`text-xs ${place === county ? "text-cream-50/80" : "text-muted"}`}>{count}</span>
                </motion.button>
              );
            })}
          </div>
          <p className="pt-1 text-xs font-medium text-ink-soft">{t("location.places")}</p>
          <PlaceChips place={place} onPlaceChange={onPlaceChange} />
        </Section>

        {/* Preț */}
        <Section
          icon={Wallet}
          title={t("price.title")}
          summary={filters.price ? `${price(lo)} – ${price(hi)}` : t("price.any")}
        >
          {/* Histogramă: barele din intervalul ales sunt colorate */}
          <div className="flex h-14 items-end gap-1 px-1" aria-hidden>
            {histogram.map((b, i) => {
              const inRange = b.to > lo && b.from < hi;
              return (
                <motion.span
                  key={i}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ ...spring, delay: i * 0.02 }}
                  style={{ height: `${Math.max(8, (b.count / maxBin) * 100)}%`, transformOrigin: "bottom" }}
                  className={`flex-1 rounded-t-md transition-colors ${inRange ? "bg-accent/80" : "bg-sand-200"}`}
                />
              );
            })}
          </div>

          <RangeSlider
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={PRICE_STEP}
            lo={lo}
            hi={hi}
            onChange={setPrice}
            labels={[t("price.minLabel"), t("price.maxLabel")]}
          />

          <div className="grid grid-cols-2 gap-2">
            <PriceBox label={t("price.min")} value={price(lo)} />
            <PriceBox label={t("price.max")} value={price(hi)} />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {priceShortcuts.map((s) => {
              const on = !!filters.price && lo === s.range[0] && hi === s.range[1];
              return (
                <Chip key={s.id} on={on} onClick={() => (on ? set({ price: null }) : setPrice(s.range[0], s.range[1]))}>
                  {t(`price.shortcuts.${s.id}`)}
                </Chip>
              );
            })}
          </div>
        </Section>

        {/* Tip unitate – dale 2×2 */}
        <Section
          icon={House}
          title={t("type.title")}
          summary={filters.types.length ? t("selected", { count: filters.types.length }) : t("all")}
        >
          <div className="grid grid-cols-2 gap-2">
            {unitTypes.map((type) => {
              const Icon = typeIcons[type];
              const on = filters.types.includes(type);
              return (
                <motion.button
                  key={type}
                  type="button"
                  aria-pressed={on}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => set({ types: toggle(filters.types, type) })}
                  className={`relative flex flex-col items-start gap-2 rounded-2xl p-3 text-left transition-colors ${
                    on ? "bg-accent text-cream-50 shadow-accent" : "bg-cream-50 text-ink shadow-pill hover:bg-cream-100"
                  }`}
                >
                  <Icon className={`size-6 ${on ? "" : "text-accent"}`} strokeWidth={1.8} />
                  <span className="text-sm font-semibold">{tUnit(`types.${type}`)}</span>
                  <span className={`absolute top-2.5 right-3 text-xs font-medium ${on ? "text-cream-50/80" : "text-muted"}`}>
                    {typeCounts[type]}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </Section>

        {/* Camere */}
        <Section
          icon={BedDouble}
          title={t("rooms.title")}
          summary={
            filters.bedrooms || filters.bathrooms
              ? [filters.bedrooms && t("rooms.bedroomsShort", { count: filters.bedrooms }), filters.bathrooms && t("rooms.bathroomsShort", { count: filters.bathrooms })]
                  .filter(Boolean)
                  .join(" · ")
              : t("any")
          }
        >
          <Segmented
            label={t("rooms.bedrooms")}
            options={roomOptions}
            value={filters.bedrooms}
            render={(v) => (v === 0 ? t("any") : t("rooms.min", { count: v }))}
            onChange={(v) => set({ bedrooms: v })}
          />
          <Segmented
            label={t("rooms.bathrooms")}
            options={roomOptions}
            value={filters.bathrooms}
            render={(v) => (v === 0 ? t("any") : t("rooms.min", { count: v }))}
            onChange={(v) => set({ bathrooms: v })}
          />
        </Section>

        {/* Rating */}
        <Section
          icon={Star}
          title={t("rating.title")}
          summary={filters.minRating ? t("rating.min", { rating: filters.minRating }) : t("any")}
        >
          <Segmented
            options={ratingOptions}
            value={filters.minRating}
            render={(v) =>
              v === 0 ? (
                t("rating.any")
              ) : (
                <span className="inline-flex items-center gap-0.5">
                  <Star className="size-3 fill-star text-star" />
                  {v}+
                </span>
              )
            }
            onChange={(v) => set({ minRating: v })}
          />
        </Section>

        {/* Facilități – grilă cu bifă */}
        <Section
          icon={Sparkles}
          title={t("amenities.title")}
          summary={filters.amenities.length ? t("selected", { count: filters.amenities.length }) : t("any")}
        >
          <div className="grid grid-cols-2 gap-1.5">
            {allAmenities.map((a) => {
              const Icon = amenityIcons[a];
              const on = filters.amenities.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ amenities: toggle(filters.amenities, a) })}
                  className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                    on ? "bg-accent-50 text-accent ring-1 ring-accent/40" : "bg-cream-50 text-ink-soft shadow-pill hover:text-ink"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{tAmenity(a)}</span>
                  {on ? (
                    <Check className="size-3.5 shrink-0" strokeWidth={3} />
                  ) : (
                    <span className="text-[11px] text-muted">{amenityCounts[a]}</span>
                  )}
                </button>
              );
            })}
          </div>
        </Section>
      </div>

      {/* Subsol: câte unități se potrivesc */}
      <div className="border-t border-sand bg-cream-100/70 px-5 py-4">
        {onClose ? (
          <div className="flex gap-2">
            <button type="button" onClick={onClear} className="rounded-full px-4 py-3 text-sm font-medium text-ink-soft hover:text-ink">
              {t("clear")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full bg-accent py-3 text-sm font-semibold text-cream-50 shadow-accent"
            >
              {t("showResults", { count: resultCount })}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-soft">{t("found")}</p>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={resultCount}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                transition={spring}
                className="font-serif text-2xl text-ink"
              >
                {resultCount}
              </motion.p>
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Componente mici ---------- */

// Secțiune pliabilă: titlu cu iconiță + rezumatul alegerii, conținutul se deschide animat
function Section({
  icon: Icon,
  title,
  summary,
  children,
}: {
  icon: LucideIcon;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-inner bg-cream-100 shadow-pressed">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 p-3.5 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cream-50 text-accent shadow-pill">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="block truncate text-xs text-muted">{summary}</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring} className="text-ink-soft">
          <ChevronDown className="size-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-3.5 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// Slider cu două capete (minim și maxim)
function RangeSlider({
  min,
  max,
  step,
  lo,
  hi,
  onChange,
  labels,
}: {
  min: number;
  max: number;
  step: number;
  lo: number;
  hi: number;
  onChange: (lo: number, hi: number) => void;
  labels: [string, string];
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const thumb =
    "pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent " +
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:bg-cream-50 [&::-webkit-slider-thumb]:shadow-pill " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-accent [&::-moz-range-thumb]:bg-cream-50";
  return (
    <div className="relative h-6">
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-sand-200" />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent"
        style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
      />
      <input
        type="range"
        aria-label={labels[0]}
        min={min}
        max={max}
        step={step}
        value={lo}
        onChange={(e) => onChange(Math.min(Number(e.target.value), hi - step), hi)}
        className={thumb}
      />
      <input
        type="range"
        aria-label={labels[1]}
        min={min}
        max={max}
        step={step}
        value={hi}
        onChange={(e) => onChange(lo, Math.max(Number(e.target.value), lo + step))}
        className={thumb}
      />
    </div>
  );
}

function PriceBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-cream-50 px-3 py-2 shadow-pill">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        on ? "bg-accent text-cream-50 shadow-accent" : "bg-cream-50 text-ink-soft shadow-pill hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

// Butoane lipite, cu un indicator care alunecă pe opțiunea aleasă
function Segmented({
  label,
  options,
  value,
  render,
  onChange,
}: {
  label?: string;
  options: number[];
  value: number;
  render: (v: number) => ReactNode;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div>
      {label && <p className="mb-1.5 text-xs font-medium text-ink-soft">{label}</p>}
      <div className="flex rounded-full bg-cream-50 p-1 shadow-pill">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={`relative flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors ${
              value === o ? "text-cream-50" : "text-ink-soft hover:text-ink"
            }`}
          >
            {value === o && (
              <motion.span layoutId={`seg-${id}`} transition={spring} className="absolute inset-0 rounded-full bg-accent shadow-accent" />
            )}
            <span className="relative">{render(o)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Localitățile cu cazări: primele 5 (cele cu cele mai multe unități), restul la „Vezi mai multe"
const PLACES_PREVIEW = 5;

function PlaceChips({ place, onPlaceChange }: { place: string | null; onPlaceChange: (p: string | null) => void }) {
  const t = useTranslations("Filters");
  const [all, setAll] = useState(false);
  const { sitePlaces } = usePlaces();

  // dacă e ales un județ, arătăm doar localitățile lui
  const county = place && !place.includes(",") ? place : place?.split(",")[1]?.trim();
  const list = [...sitePlaces]
    .filter((p) => !county || p.county === county)
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, "ro"));
  const visible = all ? list : list.slice(0, PLACES_PREVIEW);
  const hidden = list.length - PLACES_PREVIEW;

  return (
    <div>
      <motion.div layout className="flex flex-wrap gap-1.5">
        <AnimatePresence initial={false}>
          {visible.map((p, i) => {
            const on = place === p.label;
            return (
              <motion.span
                key={p.label}
                layout="position"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1, transition: { ...spring, delay: all && i >= PLACES_PREVIEW ? (i - PLACES_PREVIEW) * 0.025 : 0 } }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
              >
                <Chip on={on} onClick={() => onPlaceChange(on ? p.county : p.label)}>
                  {p.city} <span className={on ? "text-cream-50/80" : "text-muted"}>· {p.count}</span>
                </Chip>
              </motion.span>
            );
          })}
        </AnimatePresence>
      </motion.div>
      {hidden > 0 && (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll(!all)}
          className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-accent underline-offset-4 hover:underline"
        >
          {all ? t("location.showLess") : t("location.showMore", { count: hidden })}
          <motion.span animate={{ rotate: all ? 180 : 0 }} transition={spring}>
            <ChevronDown className="size-3.5" />
          </motion.span>
        </button>
      )}
    </div>
  );
}
