"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import "./maplibre-setup";
import { Map as MapLibre, Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";

// Hartă mică, fixă (fără zoom/tragere), cu un singur pin – în panoul unității
export default function UnitMiniMap({ lat, lng }: { lat: number; lng: number }) {
  const container = useRef<HTMLDivElement>(null);
  const dark = useTheme().theme === "dark";

  useEffect(() => {
    if (!container.current) return;
    const m = new MapLibre({
      container: container.current,
      style: `https://tiles.openfreemap.org/styles/${dark ? "dark" : "positron"}`,
      center: [lng, lat],
      zoom: 16,
      interactive: false,
      attributionControl: false,
    });
    const el = document.createElement("div");
    el.className = "grid size-9 place-items-center rounded-full bg-accent shadow-accent ring-4 ring-accent/25";
    el.innerHTML = '<span class="size-2.5 rounded-full bg-cream-50"></span>';
    new Marker({ element: el }).setLngLat([lng, lat]).addTo(m);
    return () => m.remove();
  }, [lat, lng, dark]);

  return <div ref={container} className="h-full w-full" />;
}
