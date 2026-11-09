"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, Heart, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { nightly, type Unit } from "@/lib/mock-units";
import { rise, spring } from "@/components/ui/motion";
import { amenityIcons } from "./icons";
import { usePrice } from "./use-price";
import type { ViewMode } from "./ViewToggle";

type Props = {
  unit: Unit;
  nights: number; // nopțile din sejurul ales, pentru prețul total
  selected: boolean;
  onSelect: () => void;
  onFavorite: () => void;
  favorite?: boolean; // în favoritele contului
  priority?: boolean;
  view: ViewMode;
  index?: number; // poziția în listă, pentru intrarea pe rând
};

/*
  Cardul unei unități. Conținut, de sus în jos:
  poză (+ ofertă / tip) · nume + stele · „tip · oaspeți · oraș" · 2 facilități-cheie · preț pe noapte · total sejur.
  3 variante: grilă normală, grilă densă (5 coloane) și listă.
  Cardul e un buton; inima e un buton separat, deasupra lui (nu putem pune buton în buton).
*/
export function UnitCard({ unit, nights, selected, onSelect, onFavorite, favorite = false, priority, view, index = 0 }: Props) {
  const t = useTranslations("Unit");
  const tAmenity = useTranslations("Amenities");
  const tDetail = useTranslations("Detail");
  const price = usePrice();

  // La hover, pozele din galerie se schimbă una după alta, cu fade in / fade out.
  // Pozele 2 și 3 se încarcă abia la primul hover (nu 3 poze × 29 de carduri la deschiderea paginii).
  const [hover, setHover] = useState(false);
  const [warm, setWarm] = useState(false);
  const [photo, setPhoto] = useState(0);
  useEffect(() => {
    if (!hover) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const total = unit.photos.length;
    const first = setTimeout(() => setPhoto(1 % total), 500);
    const loop = setInterval(() => setPhoto((p) => (p + 1) % total), 1500);
    return () => {
      clearTimeout(first);
      clearInterval(loop);
    };
  }, [hover, unit.photos.length]);
  const list = view === "list";
  const dense = view === "grid5";
  const perNight = nightly(unit);
  const city = unit.location.split(",")[0];

  return (
    <motion.div
      layout="position"
      variants={rise}
      custom={index}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 0.92, filter: "blur(6px)", transition: { duration: 0.18 } }}
      whileHover={{ y: -4, transition: spring }}
      onMouseEnter={() => {
        setHover(true);
        setWarm(true);
      }}
      onMouseLeave={() => {
        setHover(false);
        setPhoto(0); // la plecarea mouse-ului revine la prima poză, tot cu fade
      }}
      className="group relative"
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={t("open", { name: unit.name })}
        className={`flex h-full w-full rounded-card bg-cream-50 text-left shadow-soft transition-shadow duration-300 group-hover:shadow-[0_24px_40px_-20px_rgb(74_58_36/0.4)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
          list ? "flex-row gap-4 p-2.5" : dense ? "flex-col p-2" : "flex-col p-2.5"
        } ${selected ? "ring-2 ring-accent/70" : ""}`}
      >
        <div
          className={`relative overflow-hidden rounded-inner ${
            list ? "aspect-[4/3] w-40 shrink-0 sm:w-60" : "aspect-[4/3] shrink-0"
          }`}
        >
          {/* Toate pozele stau una peste alta; doar cea activă are opacitate 1 (fade între ele, fără deformare) */}
          <div className="absolute inset-0 transition duration-700 ease-out group-hover:scale-[1.06]">
            {unit.photos.map((src, i) =>
              i === 0 || warm ? (
                <Image
                  key={src}
                  src={src}
                  alt=""
                  fill
                  priority={priority && i === 0}
                  sizes={list ? "240px" : dense ? "(min-width: 1536px) 15vw, 30vw" : "(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 92vw"}
                  className="object-cover transition-opacity duration-700 ease-in-out"
                  style={{ opacity: i === photo ? 1 : 0 }}
                />
              ) : null,
            )}
          </div>
          {unit.offer ? (
            <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-star px-2.5 py-1 text-xs font-bold text-ink shadow-pill">
              {t("discount", { percent: unit.offer.percent })}
              {!dense && <span className="font-semibold">· {t(`offers.${unit.offer.label}`)}</span>}
            </span>
          ) : (
            !dense && (
              <span className="absolute top-3 left-3 rounded-full bg-cream-50/90 px-3 py-1 text-xs font-semibold text-ink shadow-pill backdrop-blur">
                {t(`types.${unit.type}`)}
              </span>
            )
          )}
        </div>

        <div
          className={`flex min-w-0 flex-1 flex-col ${
            list ? "gap-2 py-2 pr-12" : dense ? "gap-1.5 px-1.5 pt-3 pb-1.5" : "gap-2 px-2.5 pt-3.5 pb-2"
          }`}
        >
          {/* Nume + stele */}
          <div className="flex items-start justify-between gap-2">
            <h3 className={`line-clamp-2 min-h-[2lh] leading-snug font-semibold text-ink ${dense ? "text-base" : "text-lg"}`}>
              {unit.name}
            </h3>
            {unit.rating !== null && (
              <span
                className="flex shrink-0 items-center gap-1 text-base font-semibold text-ink"
                aria-label={t("rating", { rating: unit.rating })}
              >
                <Star className="size-4 fill-star text-star" />
                {unit.rating.toFixed(1)}
              </span>
            )}
          </div>

          {/* Rând 2: tip · oraș / oaspeți (stânga, pe 2 rânduri) | facilități-cheie (dreapta) */}
          <div className="flex items-center justify-between gap-2">
            <div className={`min-w-0 leading-snug text-muted ${dense ? "text-[13px]" : "text-sm"}`}>
              <p className="truncate">{t("metaPlace", { type: t(`types.${unit.type}`), city })}</p>
              <p className="truncate">{t("metaGuests", { count: unit.maxGuests })}</p>
            </div>
            <ul className="flex shrink-0 gap-1.5">
              {unit.highlights.map((a) => {
                const Icon = amenityIcons[a];
                return (
                  <li
                    key={a}
                    title={tAmenity(a)}
                    className={`grid place-items-center rounded-full bg-cream-100 text-accent shadow-pressed ${dense ? "size-8" : "size-9"}`}
                  >
                    <Icon className={dense ? "size-4" : "size-[18px]"} aria-hidden />
                    <span className="sr-only">{tAmenity(a)}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Rând 3: preț pe noapte (stânga) | total sejur (dreapta) | săgeată */}
          <div className="flex items-end justify-between gap-2 border-t border-sand pt-2.5">
            <div className="min-w-0">
              {unit.offer && (
                <span
                  className="block text-[13px] leading-none text-muted line-through"
                  aria-label={t("oldPrice", { price: price(unit.pricePerNight) })}
                >
                  {price(unit.pricePerNight)}
                </span>
              )}
              <p className={`font-bold leading-tight text-ink ${dense ? "text-xl" : "text-2xl"}`}>
                {price(perNight)}
              </p>
              <p className="text-xs text-muted">{t("perNightShort")}</p>
            </div>
            <div className="flex items-end gap-2">
              {nights > 0 && (
                <div className="text-right">
                  <p className={`font-semibold leading-tight text-ink ${dense ? "text-[15px]" : "text-base"}`}>
                    {price(perNight * nights)}
                  </p>
                  <p className="text-xs whitespace-nowrap text-muted">
                    {t("totalShort", { nights: tDetail("booking.nights", { count: nights }) })}
                  </p>
                </div>
              )}
              {!dense && (
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-full shadow-pill transition ${
                    selected ? "bg-accent text-cream-50" : "bg-cream-50 text-ink group-hover:translate-x-0.5"
                  }`}
                  aria-hidden
                >
                  <ChevronRight className="size-4" />
                </span>
              )}
            </div>
          </div>
        </div>
      </button>

      <motion.button
        type="button"
        onClick={onFavorite}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.82 }}
        transition={spring}
        aria-label={t("favorite", { name: unit.name })}
        aria-pressed={favorite}
        className={`absolute z-10 grid place-items-center rounded-full bg-cream-50/90 shadow-pill backdrop-blur hover:text-red-600 ${
          favorite ? "text-red-600" : "text-ink"
        } ${
          dense ? "top-3.5 right-3.5 size-8" : list ? "top-4 right-4 size-9" : "top-5 right-5 size-9"
        }`}
      >
        <Heart className={dense ? "size-4" : "size-[18px]"} fill={favorite ? "currentColor" : "none"} />
      </motion.button>
    </motion.div>
  );
}
