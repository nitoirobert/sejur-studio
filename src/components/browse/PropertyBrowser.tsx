"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { defaultStay, units as allUnits } from "@/lib/mock-units";
import { useUnits } from "@/lib/use-units";
import { useTheme } from "@/lib/theme";
import { occupancy } from "@/lib/guests";
import { backdrop, spring } from "@/components/ui/motion";
import { SiteHeader } from "./SiteHeader";
import { Toolbar } from "./Toolbar";
import { FilterSidebar } from "./FilterSidebar";
import { UnitCard } from "./UnitCard";
import { UnitPanel, nightsBetween } from "./UnitPanel";
import { AuthModal, type AuthReason } from "./AuthModal";
import { ViewToggle, type ViewMode } from "./ViewToggle";
import { applyFilters, countActive, emptyFilters, matchesPlace, matchesQuery, type Filters } from "./filters";

// Câte coloane are grila, în funcție de modul ales și de lățimea ecranului
const gridClasses: Record<ViewMode, string> = {
  grid3: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
  grid5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5",
  list: "grid-cols-1",
  map: "",
};

// Harta se încarcă doar în browser și doar când e aleasă (biblioteca e mare)
const UnitsMap = dynamic(() => import("./UnitsMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-cream-100" />,
});

// guests = adulți; kids = copii 2–5 ani (ocupă loc); infants = bebeluși 0–2 ani (nu ocupă loc)
export type Stay = { from: string; to: string; guests: number; kids: number; infants: number };

/*
  Desktop (≥1280px):  [Filtre] [Grilă / listă] [Panou unitate + rezervare]
  Filtrele rămân mereu vizibile; panoul din dreapta apare doar după click pe o unitate.
  Sub 1280px: panoul și filtrele se deschid peste pagină.

  Animații: biblioteca „motion". MotionConfig reducedMotion="user" le oprește automat
  pentru cine a cerut „mișcare redusă" în setările sistemului.
*/
export function PropertyBrowser() {
  const t = useTranslations("Results");
  const tFilters = useTranslations("Filters");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthReason | null>(null);
  const [view, setView] = useState<ViewMode>("grid5");
  const { theme } = useTheme();
  const [stay, setStay] = useState<Stay>({
    from: defaultStay.from,
    to: defaultStay.to,
    guests: defaultStay.guests,
    kids: 0,
    infants: 0,
  });

  const units = useUnits(); // numele și descrierile în limba aleasă
  const results = useMemo(
    () =>
      applyFilters(units, filters).filter(
        (u) => matchesQuery(u, query) && matchesPlace(u, place) && u.maxGuests >= occupancy(stay),
      ),
    [units, filters, query, place, stay],
  );
  const selected = units.find((u) => u.id === selectedId) ?? null;
  const close = () => setSelectedId(null);

  // Venit de pe pagina unei cazări (/?cazare=<id>): redeschidem panoul ei, apoi curățăm adresa
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("cazare");
    if (!id) return;
    // Adresa e o sursă externă, citită o singură dată după hidratare (pe server nu există),
    // deci setState aici e intenționat; pagina de start rămâne statică.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (allUnits.some((u) => u.id === id)) setSelectedId(id);
    url.searchParams.delete("cazare");
    window.history.replaceState(null, "", url);
  }, []);

  // Escape închide panoul (dacă nu e deschis popup-ul de autentificare)
  useEffect(() => {
    if (!selectedId || auth) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelectedId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, auth]);

  const activeFilterCount = countActive(filters);

  const clear = () => {
    setFilters(emptyFilters);
    setPlace(null);
  };

  // Click pe logo / „Sejur Studio": înapoi la pagina de start – grila cu 5 coloane, fără filtre și fără panouri
  const goHome = () => {
    setView("grid5");
    setFilters(emptyFilters);
    setQuery("");
    setPlace(null);
    setSelectedId(null);
    setFiltersOpen(false);
    setAuth(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("results-title")?.closest("section")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const bar = {
    stay,
    onStayChange: setStay,
    query,
    onQueryChange: setQuery,
    onOpenUnit: setSelectedId,
    place,
    onPlaceChange: setPlace,
  };

  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader {...bar} onFavorites={() => setAuth("favorite")} onLogin={() => setAuth("login")} onHome={goHome} />
      <Toolbar
        {...bar}
        onOpenFilters={() => setFiltersOpen(true)}
        activeFilterCount={activeFilterCount}
      />

      <div className="flex items-start gap-5 pb-10 lg:min-h-0 lg:flex-1 lg:items-stretch lg:pb-5">
        {/* Coloana filtre: mereu vizibilă pe desktop */}
        <motion.aside
          initial={{ opacity: 0, x: -30, filter: "blur(8px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          transition={{ ...spring, delay: 0.1 }}
          className="hidden w-72 shrink-0 xl:block 2xl:w-80"
        >
          <FilterSidebar filters={filters} onChange={setFilters} onClear={clear} resultCount={results.length} place={place} onPlaceChange={setPlace} stay={stay} onStayChange={setStay} />
        </motion.aside>

        {/* Grila de unități */}
        <section
          className="-m-2 flex min-w-0 flex-1 flex-col p-2 lg:overflow-y-auto"
          aria-labelledby="results-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.12 }}
            className="flex items-end justify-between gap-3 pb-4 dark:[text-shadow:0_2px_14px_rgb(0_0_0/0.7)]"
          >
            <div>
              <h1 id="results-title" className="font-brand text-3xl font-bold tracking-tight leading-tight">
                {t("title")}
              </h1>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={results.length}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="mt-1 text-sm text-ink-soft"
                >
                  {t("subtitle", { count: results.length })}
                </motion.p>
              </AnimatePresence>
            </div>
            <ViewToggle value={view} onChange={setView} />
          </motion.div>

          {/*
            Schimbarea modului (grilă ↔ listă ↔ hartă): vechea afișare se estompează,
            apoi cea nouă intră card cu card. Nu animăm dimensiunea cardurilor
            (ar deforma pozele și textul) – doar opacitate, poziție și un blur fin.
          */}
          <AnimatePresence mode="wait" initial={false}>
            {results.length === 0 && view !== "map" ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={spring}
                className="grid place-items-center rounded-card bg-cream-100 px-6 py-16 text-center shadow-pressed"
              >
                <p className="text-ink-soft">{t("empty")}</p>
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => {
                    clear();
                    setQuery("");
                    setPlace(null);
                  }}
                  className="mt-4 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-cream-50 shadow-accent"
                >
                  {t("reset")}
                </motion.button>
              </motion.div>
            ) : view === "map" ? (
              <motion.div
                key="map"
                initial={{ opacity: 0, scale: 0.985, filter: "blur(6px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.985, filter: "blur(6px)", transition: { duration: 0.2 } }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="min-h-[65vh] flex-1 overflow-hidden rounded-card shadow-soft ring-4 ring-cream-50"
              >
                <UnitsMap
                  key={theme}
                  dark={theme === "dark"}
                  units={results}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelectedId}
                  county={place ? (place.includes(",") ? place.split(",")[1].trim() : place) : null}
                  onCountySelect={setPlace}
                />
              </motion.div>
            ) : (
              <motion.div
                key={view}
                exit={{ opacity: 0, y: 6, filter: "blur(4px)", transition: { duration: 0.18, ease: "easeIn" } }}
                className={`grid gap-4 ${gridClasses[view]}`}
              >
                <AnimatePresence mode="popLayout">
                  {results.map((unit, i) => (
                    <UnitCard
                      key={unit.id}
                      unit={unit}
                      view={view}
                      nights={nightsBetween(stay.from, stay.to)}
                      priority={i < 5}
                      index={i}
                      selected={selected?.id === unit.id}
                      onSelect={() => setSelectedId(unit.id)}
                      onFavorite={() => setAuth("favorite")}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Panoul unității (desktop) – intră din dreapta cu un arc moale */}
        <AnimatePresence mode="popLayout">
          {selected && (
            <motion.aside
              key="panel"
              initial={{ opacity: 0, x: 80, scale: 0.96, filter: "blur(12px)" }}
              animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: 60, scale: 0.97, filter: "blur(8px)", transition: { duration: 0.22 } }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              style={{ transformOrigin: "right center" }}
              className="hidden w-[420px] shrink-0 xl:block 2xl:w-[480px]"
            >
              <UnitPanel key={selected.id} unit={selected} stay={stay} onStayChange={setStay} onClose={close} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Sertar cu filtre */}
      <AnimatePresence>
        {filtersOpen && (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
            <motion.button
              type="button"
              variants={backdrop}
              initial="hidden"
              animate="show"
              exit="exit"
              className="absolute inset-0 bg-[#0b1220]/35 backdrop-blur-sm"
              onClick={() => setFiltersOpen(false)}
              aria-label={tFilters("close")}
            />
            <motion.div
              initial={{ x: "-110%" }}
              animate={{ x: 0 }}
              exit={{ x: "-110%" }}
              transition={{ type: "spring", stiffness: 300, damping: 34 }}
              className="absolute inset-y-3 left-3 w-[min(22rem,calc(100%-1.5rem))]"
            >
              <FilterSidebar
                filters={filters}
                onChange={setFilters}
                onClear={clear}
                onClose={() => setFiltersOpen(false)}
                resultCount={results.length}
                place={place}
                onPlaceChange={setPlace}
                stay={stay}
                onStayChange={setStay}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Panoul unității sub 1280px: peste pagină – de jos pe telefon, din dreapta pe tabletă */}
      <AnimatePresence>
        {selected && (
          <div key="sheet" className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true">
            <motion.button
              type="button"
              variants={backdrop}
              initial="hidden"
              animate="show"
              exit="exit"
              className="absolute inset-0 bg-[#0b1220]/35 backdrop-blur-sm"
              onClick={close}
              aria-label={tFilters("close")}
            />
            <motion.div
              initial={{ y: "100%", opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.6 }}
              transition={{ type: "spring", stiffness: 280, damping: 32 }}
              className="absolute inset-x-2 top-4 bottom-2 sm:inset-x-auto sm:inset-y-3 sm:right-3 sm:w-[440px]"
            >
              <UnitPanel key={selected.id} unit={selected} stay={stay} onStayChange={setStay} onClose={close} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Popup autentificare / cont nou */}
      <AnimatePresence>
        {auth && <AuthModal key="auth" reason={auth} onClose={() => setAuth(null)} />}
      </AnimatePresence>
    </MotionConfig>
  );
}

