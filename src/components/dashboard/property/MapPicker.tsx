"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import "@/components/browse/maplibre-setup";
import { Map as MapLibre, Marker, NavigationControl } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";

// Romania, whole country in view, while there is no pin yet.
const ROMANIA: [number, number] = [24.97, 45.94];

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function makePin(map: MapLibre, lngLat: [number, number], onDrag: (lng: number, lat: number) => void): Marker {
  const el = document.createElement("div");
  el.className = "grid size-9 cursor-grab place-items-center rounded-full bg-accent shadow-accent ring-4 ring-accent/25";
  el.innerHTML = '<span class="size-2.5 rounded-full bg-cream-50"></span>';
  el.setAttribute("data-testid", "map-pin");
  const marker = new Marker({ element: el, draggable: true }).setLngLat(lngLat).addTo(map);
  marker.on("dragend", () => {
    const p = marker.getLngLat();
    onDrag(p.lng, p.lat);
  });
  return marker;
}

/*
  The property pin: a click on the map puts it there, the pin can be dragged. The map is rebuilt
  when the theme changes (other tile style); the pin comes from props, so nothing is lost.
*/
export default function MapPicker({
  lat,
  lng,
  label,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  label: string;
  onChange: (lat: number, lng: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const marker = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const pin = useRef<[number, number] | null>(lat !== null && lng !== null && valid(lat, lng) ? [lng, lat] : null);
  const dark = useTheme().theme === "dark";

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const dragged = (lngV: number, latV: number) => {
    pin.current = [lngV, latV];
    onChangeRef.current(round6(latV), round6(lngV));
  };

  useEffect(() => {
    if (!container.current) return;
    const m = new MapLibre({
      container: container.current,
      style: `https://tiles.openfreemap.org/styles/${dark ? "dark" : "positron"}`,
      center: pin.current ?? ROMANIA,
      zoom: pin.current ? 14 : 5.4,
      attributionControl: { compact: true },
      cooperativeGestures: true,
    });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.current = m;

    const place = (lngLat: [number, number]) => {
      if (marker.current) marker.current.setLngLat(lngLat);
      else marker.current = makePin(m, lngLat, dragged);
    };
    if (pin.current) place(pin.current);

    m.on("click", (e) => {
      const next: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      pin.current = next;
      place(next);
      onChangeRef.current(round6(e.lngLat.lat), round6(e.lngLat.lng));
    });

    return () => {
      marker.current = null;
      map.current = null;
      m.remove();
    };
  }, [dark]);

  // Coordinates typed in the inputs (or cleared) move the pin.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    // Out-of-range values never reach maplibre (it throws "Invalid LngLat"); the form shows the field error.
    if (lat === null || lng === null || !valid(lat, lng)) {
      pin.current = null;
      marker.current?.remove();
      marker.current = null;
      return;
    }
    const cur = pin.current;
    if (cur && Math.abs(cur[0] - lng) < 1e-7 && Math.abs(cur[1] - lat) < 1e-7) return;
    pin.current = [lng, lat];
    if (marker.current) marker.current.setLngLat([lng, lat]);
    else marker.current = makePin(m, [lng, lat], dragged);
    m.easeTo({ center: [lng, lat], zoom: Math.max(m.getZoom(), 12), duration: 400 });
  }, [lat, lng]);

  return <div ref={container} role="application" aria-label={label} data-testid="property-map" className="size-full" />;
}
