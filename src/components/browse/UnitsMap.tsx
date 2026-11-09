"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import "./maplibre-setup";
import {
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibre,
  Marker,
  NavigationControl,
  type ExpressionSpecification,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { nightly, photoThumb, type MappedUnit as Unit } from "@/lib/mock-units";
import { usePlaces } from "@/lib/search/catalog";
import { usePrice } from "./use-price";

/*
  Harta cu cazările.
  - Hartă: MapLibre + stilul gratuit OpenFreeMap (fără cheie API).
  - La intrare, harta e încadrată pe județele în care avem cazări; apoi poți face zoom și o poți trage liber.
  - Nivel 1 (toate județele): în mijlocul fiecărui județ stă un pin cu NUMĂRUL EXACT de cazări.
  - Click pe pin (sau pe județ): harta zboară în județ și apar pin-urile cazărilor pe adresa exactă,
    ca „pastile" cu prețul pe noapte (cele apropiate se grupează într-un cerc cu număr).
  - Butonul „Toate județele" te întoarce la nivelul 1.
  - În fiecare județ e conturată și localitatea (doar cele în care avem cazări).
  - Granițele județelor: geoBoundaries (CC BY 4.0); localitățile: © OpenStreetMap contributors (ODbL).
*/

const STYLE = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
const SOURCE = "units";
const COUNTIES = "judete";
const LOCALITIES = "localitati";

type Props = {
  units: Unit[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  county: string | null; // județul deschis (null = nivelul „toate județele")
  onCountySelect: (county: string | null) => void;
  dark: boolean; // tema de noapte: altă hartă, alte culori
};

const pillBase =
  "rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap shadow-pill ring-1 transition-transform duration-200 hover:scale-110 cursor-pointer animate-[pin-pop_.35s_ease-out]";
const pillIdle = "bg-cream-50 text-ink ring-sand";
const pillOffer = "bg-star text-ink ring-star";
const pillSelected = "bg-accent text-cream-50 ring-accent scale-110";

type CountyInfo = { center: [number, number]; bounds: LngLatBounds };

/* ---------- Geometrie: centrul și limitele fiecărui județ ---------- */

function ringArea(ring: number[][]) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2;
}

function ringCentroid(ring: number[][]): [number, number] {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  a /= 2;
  return [cx / (6 * a), cy / (6 * a)];
}

function analyse(geo: GeoJSON.FeatureCollection): Record<string, CountyInfo> {
  const out: Record<string, CountyInfo> = {};
  for (const f of geo.features) {
    const name = f.properties?.name as string | undefined;
    if (!name || !("coordinates" in f.geometry)) continue;
    const polys = (f.geometry.type === "Polygon"
      ? [f.geometry.coordinates]
      : f.geometry.type === "MultiPolygon"
        ? f.geometry.coordinates
        : []) as number[][][][];
    const bounds = new LngLatBounds();
    let best: number[][] | null = null;
    let bestArea = 0;
    for (const poly of polys) {
      const outer = poly[0];
      outer.forEach(([x, y]) => bounds.extend([x, y]));
      const area = Math.abs(ringArea(outer));
      if (area > bestArea) {
        bestArea = area;
        best = outer;
      }
    }
    if (best) out[name] = { center: ringCentroid(best), bounds };
  }
  return out;
}

function toGeoJSON(units: Unit[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: units.map((u) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [u.lng, u.lat] },
      properties: { id: u.id },
    })),
  };
}

const STREET_ZOOM = 17; // nivelul la care se văd străzile și numerele

const countyOf = (u: Unit) => u.location.split(",")[1]?.trim() ?? "";

export default function UnitsMap({ units, selectedId, onSelect, county, onCountySelect, dark }: Props) {
  const t = useTranslations("Map");
  const tUnit = useTranslations("Unit");
  const c = dark
    ? { accent: "#9cc1f0", idle: "#354763", halo: "#162236", muted: "#8494ad" }
    : { accent: "#1f3d63", idle: "#e7dfd1", halo: "#fbf8f3", muted: "#8f8778" };
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const markers = useRef(new globalThis.Map<string, { marker: Marker; el: HTMLElement }>());
  const countyMarkers = useRef(new globalThis.Map<string, { marker: Marker; num: HTMLElement; button: HTMLElement }>());
  const info = useRef<Record<string, CountyInfo>>({});
  const lastCamera = useRef<string | null>(null); // ultima stare pentru care am mișcat camera
  const followUnit = useRef<{ unit: Unit; until: number } | null>(null); // recentrare cât se așază panoul
  const pendingUnit = useRef<Unit | null>(null); // unitate aleasă cât județul încă nu era deschis
  const price = usePrice();
  const { siteCounties, sitePlaces } = usePlaces();
  const withUnits = siteCounties.map((c) => c.county);
  const withCities = sitePlaces.map((p) => p.city); // doar localitățile în care avem cazări

  // Ultimele valori, citite din evenimentele hărții (care trăiesc în afara ciclului React)
  const latest = useRef({
    units,
    selectedId,
    onSelect,
    price,
    county,
    onCountySelect,
    countyLabel: (name: string, count: number) => t("countyPin", { county: name, count }),
    perNight: tUnit("perNight"),
    withUnits,
    withCities,
  });
  useEffect(() => {
    latest.current = {
      units,
      selectedId,
      onSelect,
      price,
      county,
      onCountySelect,
      countyLabel: (name, count) => t("countyPin", { county: name, count }),
      perNight: tUnit("perNight"),
      withUnits,
      withCities,
    };
  });

  /* ---------- Nivelul 1: un pin cu numărul exact de cazări în mijlocul fiecărui județ ---------- */
  const syncCounties = useRef(() => {});
  useEffect(() => {
    syncCounties.current = () => {
      const m = map.current;
      if (!m) return;
      const { units, county, onCountySelect, countyLabel } = latest.current;
      const counts = new globalThis.Map<string, number>();
      if (!county) for (const u of units) counts.set(countyOf(u), (counts.get(countyOf(u)) ?? 0) + 1);

      for (const [name, count] of counts) {
        const geo = info.current[name];
        if (!geo) continue;
        let entry = countyMarkers.current.get(name);
        if (!entry) {
          // Elementul dat lui MapLibre (root) rămâne simplu: MapLibre îl poziționează prin `transform`.
          // Stilul, hover-ul și animația stau pe butonul din interior; altfel pinul „sărea" la hover.
          const root = document.createElement("div");
          const el = document.createElement("button");
          el.type = "button";
          el.className = "group flex cursor-pointer flex-col items-center gap-1 animate-[pin-pop_.45s_cubic-bezier(.2,1.3,.4,1)]";
          root.append(el);
          const num = document.createElement("span");
          num.className =
            "grid size-14 place-items-center rounded-full bg-accent text-lg font-bold text-cream-50 shadow-accent ring-4 ring-accent/25 transition-transform duration-200 group-hover:scale-110";
          const label = document.createElement("span");
          label.className =
            "rounded-full bg-cream-50/95 px-2.5 py-0.5 text-[11px] font-bold text-ink shadow-pill ring-1 ring-sand";
          label.textContent = name;
          el.append(num, label);
          // stopPropagation: altfel același click ajunge și la județul de sub pin (stratul „judete-fill"),
          // care vede județul deja deschis și îl închide la loc — harta nu se mai mișca deloc.
          el.onclick = (e) => {
            e.stopPropagation();
            onCountySelect(name);
          };
          // cercul (nu tot pinul) stă exact pe centrul județului
          const marker = new Marker({ element: root, offset: [0, 12] }).setLngLat(geo.center).addTo(m);
          entry = { marker, num, button: el };
          countyMarkers.current.set(name, entry);
        }
        entry.num.textContent = String(count);
        entry.button.setAttribute("aria-label", countyLabel(name, count));
      }

      for (const [name, { marker }] of countyMarkers.current) {
        if (!counts.has(name)) {
          marker.remove();
          countyMarkers.current.delete(name);
        }
      }
    };
  });

  /* ---------- Nivelul 2: pin-urile cazărilor (cu grupare), doar într-un județ deschis ---------- */
  const syncMarkers = useRef(() => {});
  useEffect(() => {
    syncMarkers.current = () => {
      const m = map.current;
      if (!m || !m.getSource(SOURCE)) return;
      const { units, selectedId, onSelect, price, county } = latest.current;
      const byId = new globalThis.Map(units.map((u) => [u.id, u]));
      const seen = new Set<string>();
      // Stays at the very same address would stack their price pins exactly on top of each other
      // (only the top one could be hovered): spread them side by side, centred on the address.
      const sameSpot = new globalThis.Map<string, string[]>();
      for (const u of units) {
        const k = `${u.lat.toFixed(5)},${u.lng.toFixed(5)}`;
        sameSpot.set(k, [...(sameSpot.get(k) ?? []), u.id]);
      }
      const spread = (u: Unit): [number, number] => {
        const ids = sameSpot.get(`${u.lat.toFixed(5)},${u.lng.toFixed(5)}`) ?? [u.id];
        const i = ids.indexOf(u.id);
        return [(i - (ids.length - 1) / 2) * 84, 0];
      };

      if (county) {
        for (const f of m.querySourceFeatures(SOURCE)) {
          const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
          const props = f.properties ?? {};
          // un grup „vechi" (de dinainte să se actualizeze datele) nu poate avea mai multe unități decât avem acum
          if (props.cluster && props.point_count > units.length) continue;
          const key = props.cluster ? `c-${props.cluster_id}` : `u-${props.id}`;
          if (seen.has(key)) continue;
          seen.add(key);

          let entry = markers.current.get(key);
          if (!entry) {
            // la fel ca la județe: root simplu pentru MapLibre, butonul stilizat în interior
            const root = document.createElement("div");
            const el = document.createElement("button");
            el.type = "button";
            root.append(el);
            if (props.cluster) {
              el.className =
                "grid size-11 place-items-center rounded-full bg-accent text-sm font-bold text-cream-50 shadow-accent ring-4 ring-accent/25 transition-transform duration-200 hover:scale-110 cursor-pointer animate-[pin-pop_.35s_ease-out]";
              el.textContent = String(props.point_count);
              // Click pe grup: zoom pe unitățile din el (până se desfac în pin-uri separate, pe stradă)
              el.onclick = async (e) => {
                e.stopPropagation(); // altfel click-ul ajungea și la județ și îl închidea
                const src = m.getSource(SOURCE) as GeoJSONSource;
                try {
                  const leaves = await src.getClusterLeaves(props.cluster_id, 200, 0);
                  const ids = leaves.map((f) => (f.properties as { id: string }).id);
                  const members = latest.current.units.filter((u) => ids.includes(u.id));
                  if (members.length) {
                    flyToUnits(m, members);
                    return;
                  }
                } catch {
                  /* cădem pe zoom simplu mai jos */
                }
                m.easeTo({ center: coords, zoom: Math.min(m.getZoom() + 3, 17), duration: 700 });
              };
            } else {
              const u = byId.get(props.id);
              if (!u) continue;
              el.textContent = price(nightly(u));
              el.setAttribute("aria-label", u.name);
              el.onclick = (e) => {
                e.stopPropagation();
                onSelect(u.id);
              };
              // Previzualizare la hover / focus: poza, numele, locul, nota și prețul, deasupra pinului.
              const wrap = document.createElement("div");
              wrap.className = "group relative";
              const preview = buildPreview(u, price(nightly(u)), latest.current.perNight, () => onSelect(u.id));
              wrap.append(el, preview);
              // Pin aproape de marginea de sus a hărții: cardul se deschide dedesubt, ca să nu fie tăiat
              const place = () => {
                const box = wrap.closest(".maplibregl-map")?.getBoundingClientRect();
                const below = !!box && wrap.getBoundingClientRect().top - box.top < 230;
                preview.classList.toggle("bottom-full", !below);
                preview.classList.toggle("pb-2", !below);
                preview.classList.toggle("top-full", below);
                preview.classList.toggle("pt-2", below);
              };
              wrap.addEventListener("mouseenter", place);
              wrap.addEventListener("focusin", place);
              root.replaceChildren(wrap);
              root.classList.add("hover:z-30", "focus-within:z-30");
            }
            const unit = props.cluster ? undefined : byId.get(props.id);
            const marker = new Marker({ element: root, offset: unit ? spread(unit) : [0, 0] }).setLngLat(coords).addTo(m);
            entry = { marker, el };
            markers.current.set(key, entry);
          }
          if (!props.cluster) {
            const u = byId.get(props.id);
            const selected = props.id === selectedId;
            // Clasele se schimbă pe butonul din interior; elementul lui MapLibre (root) nu se atinge.
            const next = `${pillBase} ${selected ? pillSelected : u?.offer ? pillOffer : pillIdle}`;
            if (entry.el.dataset.cls !== next) {
              if (entry.el.dataset.cls) entry.el.classList.remove(...entry.el.dataset.cls.split(" "));
              entry.el.classList.add(...next.split(" "));
              entry.el.dataset.cls = next;
            }
            entry.marker.getElement().style.zIndex = selected ? "10" : "";
            if (u) entry.marker.setOffset(spread(u)); // the filters may have changed who shares the spot
          }
        }
      }

      for (const [key, { marker }] of markers.current) {
        if (!seen.has(key)) {
          marker.remove();
          markers.current.delete(key);
        }
      }
    };
  });

  /* ---------- Harta ---------- */
  useEffect(() => {
    if (!container.current) return;
    const m = new MapLibre({
      container: container.current,
      style: dark ? STYLE_DARK : STYLE,
      center: [26.5, 45.2],
      zoom: 6,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");

    m.on("load", () => {
      // ---- Județe: doar cele cu cazări sunt colorate și se pot apăsa; restul sunt doar contur fin ----
      m.addSource(COUNTIES, { type: "geojson", data: "/geo/judete.geojson" });
      const has: ExpressionSpecification = ["in", ["get", "name"], ["literal", latest.current.withUnits]];
      m.addLayer({
        id: "judete-fill",
        type: "fill",
        source: COUNTIES,
        filter: has,
        paint: {
          "fill-color": c.accent,
          "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.3, 0.16],
        },
      });
      m.addLayer({
        id: "judete-line",
        type: "line",
        source: COUNTIES,
        paint: { "line-color": c.accent, "line-opacity": ["case", has, 0.5, 0.12], "line-width": ["case", has, 1.4, 0.8] },
      });
      m.addLayer({
        id: "judete-selected",
        type: "line",
        source: COUNTIES,
        filter: ["==", ["get", "name"], latest.current.county ?? ""],
        paint: { "line-color": c.accent, "line-width": 3 },
      });

      // ---- Localitățile cu cazări: contur + nume ----
      m.addSource(LOCALITIES, { type: "geojson", data: "/geo/localitati.geojson" });
      const city: ExpressionSpecification = ["in", ["get", "name"], ["literal", latest.current.withCities]];
      m.addLayer({
        id: "localitati-fill",
        type: "fill",
        source: LOCALITIES,
        filter: city,
        paint: { "fill-color": c.accent, "fill-opacity": 0.22 },
      });
      m.addLayer({
        id: "localitati-line",
        type: "line",
        source: LOCALITIES,
        filter: city,
        paint: { "line-color": c.accent, "line-width": 2, "line-opacity": 0.9 },
      });
      m.addLayer({
        id: "localitati-label",
        type: "symbol",
        source: LOCALITIES,
        filter: city,
        minzoom: 9,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 12,
          "text-offset": [0, -1.4],
        },
        paint: { "text-color": c.accent, "text-halo-color": c.halo, "text-halo-width": 1.6 },
      });

      // hover + click pe județ
      let hovered: number | string | undefined;
      m.on("mousemove", "judete-fill", (e) => {
        const id = e.features?.[0]?.id;
        if (hovered !== undefined) m.setFeatureState({ source: COUNTIES, id: hovered }, { hover: false });
        hovered = id;
        if (id !== undefined) m.setFeatureState({ source: COUNTIES, id }, { hover: true });
        m.getCanvas().style.cursor = "pointer";
      });
      m.on("mouseleave", "judete-fill", () => {
        if (hovered !== undefined) m.setFeatureState({ source: COUNTIES, id: hovered }, { hover: false });
        hovered = undefined;
        m.getCanvas().style.cursor = "";
      });
      m.on("click", "judete-fill", (e) => {
        // un click pe un pin (județ, grup sau cazare) e tratat de pin, nu de județul de dedesubt
        if ((e.originalEvent.target as HTMLElement | null)?.closest?.(".maplibregl-marker")) return;
        const name = e.features?.[0]?.properties?.name as string | undefined;
        if (!name) return;
        const { county, onCountySelect } = latest.current;
        onCountySelect(county === name ? null : name);
      });

      m.addSource(SOURCE, {
        type: "geojson",
        data: toGeoJSON(latest.current.units),
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 13, // de la zoom 14 în sus fiecare cazare are pinul ei
      });
      // strat invizibil: e nevoie de un strat ca sursa să fie încărcată și interogabilă
      m.addLayer({ id: "units-hidden", type: "circle", source: SOURCE, paint: { "circle-radius": 0 } });

      // ---- Centrele județelor + FIXAREA hărții pe județele noastre ----
      fetch("/geo/judete.geojson")
        .then((r) => r.json())
        .then((geo: GeoJSON.FeatureCollection) => {
          if (map.current !== m) return;
          info.current = analyse(geo);
          const all = overviewBounds(info.current, latest.current.withUnits);
          if (all) {
            m.fitBounds(all, { padding: 70, duration: 0 }); // doar la început; fără limite de zoom sau de tragere
          }
          if (latest.current.county) fit(m, latest.current.units, false);
          syncCounties.current();
          syncMarkers.current();
        })
        .catch(() => {});
    });
    m.on("sourcedata", (e) => {
      if (e.sourceId === SOURCE && e.isSourceLoaded) syncMarkers.current();
    });
    m.on("moveend", () => syncMarkers.current());
    m.on("resize", () => {
      const f = followUnit.current;
      if (f && Date.now() < f.until) m.easeTo({ center: [f.unit.lng, f.unit.lat], zoom: STREET_ZOOM, duration: 300 });
    });
    m.on("idle", () => syncMarkers.current()); // când harta s-a liniștit: scoatem pin-urile rămase de dinainte

    const markerMap = markers.current;
    const countyMap = countyMarkers.current;
    return () => {
      markerMap.forEach(({ marker }) => marker.remove());
      markerMap.clear();
      countyMap.forEach(({ marker }) => marker.remove());
      countyMap.clear();
      m.remove();
      map.current = null;
    };
    // harta se recreează când se schimbă tema (componenta primește alt „key")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Când se schimbă rezultatele sau județul deschis: actualizăm datele și zburăm unde trebuie
  useEffect(() => {
    const m = map.current;
    const src = m?.getSource(SOURCE) as GeoJSONSource | undefined;
    if (!m || !src) return;
    src.setData(toGeoJSON(units));

    // Camera: mutăm harta doar când intri/ieși dintr-un județ sau când se schimbă ce arătăm în județ.
    // În rest (filtre, căutare) harta rămâne unde ai lăsat-o, ca să poți da zoom liber.
    const sig = `${county ?? ""}|${county ? units.map((u) => u.id).join(",") : ""}`;
    if (sig !== lastCamera.current) {
      const firstRun = lastCamera.current === null;
      lastCamera.current = sig;
      if (county && pendingUnit.current) {
        flyToUnit(m, pendingUnit.current);
        pendingUnit.current = null;
      } else if (county) {
        fit(m, units, true);
      } else if (!firstRun) {
        const all = overviewBounds(info.current, latest.current.withUnits);
        if (all) m.fitBounds(all, { padding: 70, duration: 900 });
      }
    }
    syncCounties.current();
    syncMarkers.current();
  }, [units, county]);

  // Când se schimbă județul deschis: îngroșăm conturul lui
  useEffect(() => {
    const m = map.current;
    if (!m?.getLayer("judete-selected")) return;
    m.setFilter("judete-selected", ["==", ["get", "name"], county ?? ""]);
  }, [county]);

  // Când se schimbă unitatea selectată (click pe pin, pe sugestie sau altundeva): recolorăm pin-urile
  // și zburăm pe strada ei. Dacă județul nu e deschis încă, îl deschidem întâi.
  useEffect(() => {
    syncMarkers.current();
    const m = map.current;
    const unit = selectedId ? latest.current.units.find((u) => u.id === selectedId) : null;
    if (!m || !unit) return;
    if (latest.current.county) {
      // Panoul unității se deschide și îngustează harta. Cât ține asta (~1,5 s), la fiecare
      // redimensionare recentrăm pe unitate, ca pin-ul să ajungă exact în mijlocul părții vizibile.
      followUnit.current = { unit, until: Date.now() + 1500 };
      flyToUnit(m, unit);
    } else {
      pendingUnit.current = unit;
      latest.current.onCountySelect(countyOf(unit));
    }
  }, [selectedId]);

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" />
      <AnimatePresence>
        {county && (
          <motion.button
            key="back"
            type="button"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onCountySelect(null)}
            className="absolute top-3 left-3 z-10 inline-flex items-center gap-2 rounded-full bg-cream-50 px-4 py-2.5 text-sm font-semibold text-ink shadow-pill ring-1 ring-sand"
          >
            <ArrowLeft className="size-4 text-accent" />
            {t("allCounties")}
            <span className="text-muted">· {county}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Ajutoare ---------- */

// Cardul de previzualizare al unei cazări (DOM simplu: pinii trăiesc în afara lui React).
// Ascuns implicit; apare la hover sau focus pe pin. Click pe card = deschide cazarea.
function buildPreview(u: Unit, priceText: string, perNight: string, onOpen: () => void) {
  const card = document.createElement("button");
  card.type = "button";
  card.tabIndex = -1; // pinul e deja focalizabil; cardul e doar o scurtătură pentru mouse
  card.className =
    "pointer-events-none absolute bottom-full left-1/2 w-60 -translate-x-1/2 pb-2 text-left opacity-0 transition-[opacity,translate] duration-200 translate-y-1 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100";
  card.onclick = (e) => {
    e.stopPropagation();
    onOpen();
  };

  const body = document.createElement("span");
  body.className = "block overflow-hidden rounded-2xl bg-cream-50 shadow-soft ring-1 ring-sand";

  // The photo is fetched as soon as the pin exists (eager), so it is already there on the first hover.
  // A hidden lazy image is never "near the viewport", so the browser used to skip it until hover, or for good.
  // No photo / broken link: a neutral tile with the house mark instead of a broken image.
  const media = document.createElement("span");
  media.className = "relative block h-32 w-full bg-cream-200";
  const fallback = document.createElement("span");
  fallback.className = "absolute inset-0 grid place-items-center text-3xl text-sand-200";
  fallback.textContent = "⌂";
  fallback.setAttribute("aria-hidden", "true");
  media.append(fallback);
  const src = u.photos.find(Boolean);
  if (src) {
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "eager";
    img.decoding = "async";
    img.className = "absolute inset-0 block size-full object-cover";
    img.onerror = () => img.remove();
    img.src = photoThumb(src, 480);
    media.append(img);
  }

  const text = document.createElement("span");
  text.className = "block px-3 py-2.5";
  const name = document.createElement("span");
  name.className = "block truncate font-serif text-base leading-tight text-ink";
  name.textContent = u.name;
  const meta = document.createElement("span");
  meta.className = "mt-0.5 flex items-center justify-between gap-2 text-xs text-muted";
  const place = document.createElement("span");
  place.className = "truncate";
  place.textContent = u.rating !== null ? `${u.location} · ★ ${u.rating.toFixed(1)}` : u.location;
  const price = document.createElement("span");
  price.className = "shrink-0 font-bold text-ink";
  price.textContent = priceText;
  const night = document.createElement("span");
  night.className = "font-normal text-muted";
  night.textContent = ` ${perNight}`;
  price.append(night);
  meta.append(place, price);
  text.append(name, meta);

  body.append(media, text);
  card.append(body);
  return card;
}

// Zona care cuprinde toate județele cu cazări (pe ea se fixează harta)
function overviewBounds(infos: Record<string, CountyInfo>, withUnits: string[]) {
  const b = new LngLatBounds();
  let any = false;
  for (const name of withUnits) {
    const i = infos[name];
    if (!i) continue;
    b.extend(i.bounds);
    any = true;
  }
  return any ? b : null;
}

// Zoom pe stradă: un singur pin → exact pe adresa lui; mai multe → cât să încapă toate, cel mult la nivel de stradă
function flyToUnits(m: MapLibre, units: Unit[]) {
  if (units.length === 1) return flyToUnit(m, units[0]);
  const b = new LngLatBounds();
  units.forEach((u) => b.extend([u.lng, u.lat]));
  m.fitBounds(b, { padding: 110, maxZoom: STREET_ZOOM, duration: 900 });
}

function flyToUnit(m: MapLibre, u: Unit) {
  m.flyTo({ center: [u.lng, u.lat], zoom: STREET_ZOOM, duration: 1300, essential: true });
}

function fit(m: MapLibre, units: Unit[], animate: boolean, maxZoom = 14) {
  if (units.length === 0) return;
  const b = new LngLatBounds();
  units.forEach((u) => b.extend([u.lng, u.lat]));
  m.fitBounds(b, { padding: 90, maxZoom, duration: animate ? 900 : 0 });
}
