"use client";

import dynamic from "next/dynamic";
import { Map as MapIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { pill } from "@/components/ui/soft";

// Harta se încarcă doar în browser (MapLibre are nevoie de window)
const UnitMiniMap = dynamic(() => import("./UnitMiniMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-cream-100" />,
});

// Locația unității pe o hartă mică + link spre navigație (Google Maps)
export function MapCard({ location, lat, lng }: { location: string; lat: number; lng: number }) {
  const t = useTranslations("Detail");
  return (
    <div className="relative h-44 overflow-hidden rounded-inner shadow-pressed">
      <UnitMiniMap lat={lat} lng={lng} />
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
        <span className="truncate rounded-full bg-cream-50/90 px-3 py-1.5 text-xs font-medium text-ink shadow-pill backdrop-blur">
          {location}
        </span>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${pill} shrink-0 px-3.5 py-1.5 text-xs`}
        >
          <MapIcon className="size-3.5" />
          {t("viewMap")}
        </a>
      </div>
    </div>
  );
}
