"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Images,
  MapPin,
  Ruler,
  Share2,
  Star,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { PLACEHOLDER_PHOTO, type Unit } from "@/lib/mock-units";
import { card, iconButton, pill, sectionTitle } from "@/components/ui/soft";
import { amenityIcons } from "@/components/browse/icons";
import { MapCard } from "@/components/browse/MapCard";
import { ThemeToggle } from "@/components/browse/ThemeToggle";
import { usePrice } from "@/components/browse/use-price";
import { useLocalizeUnit } from "@/lib/use-units";
import { Lightbox } from "./Lightbox";
import { BookingCard, type BusyRange } from "@/components/booking/BookingCard";
import { FavoriteButton } from "@/components/booking/FavoriteButton";
import type { IsoDate } from "@/lib/dates/days";

// Poza deschisă stă în adresă (?foto=n): linkul din panou și cel copiat duc la aceeași poză.
// history.replaceState e sincronizat de Next cu useSearchParams, fără cerere la server.
function openPhoto(i: number | null) {
  const url = new URL(window.location.href);
  if (i === null) url.searchParams.delete("foto");
  else url.searchParams.set("foto", String(i));
  window.history.replaceState(null, "", url);
}

/*
  Pagina dedicată a unei cazări, după referința „Housen":
  - stânga: poza mare (favorite / distribuie peste ea), numele cu prețul, apoi câte un card pentru
    despre cazare, facilități (pastile), regulile casei și locație;
  - dreapta: restul pozelor (două mari + miniaturi), gazda și cardul de rezervare (rămâne la vedere).
*/
export function PropertyView({ unit: base, booking }: { unit: Unit; booking: { today: IsoDate; busy: BusyRange[] } }) {
  const unit = useLocalizeUnit()(base); // numele și descrierea în limba aleasă
  const t = useTranslations("Property");
  const tDetail = useTranslations("Detail");
  const tUnit = useTranslations("Unit");
  const tAmenity = useTranslations("Amenities");
  const photos = unit.photos;
  const hasGallery = photos[0] !== PLACEHOLDER_PHOTO;
  const rules = [
    tDetail("rules.checkIn", { time: unit.checkIn }),
    tDetail("rules.checkOut", { time: unit.checkOut }),
    tDetail("rules.noSmoking"),
    tDetail("rules.quiet"),
  ];

  return (
    // Pagina e mai îngustă decât restul site-ului (cerut de Robert).
    <div className="mx-auto flex w-full max-w-[1320px] flex-col px-4 pb-16 lg:px-6">
      <header className="flex items-center justify-between gap-4 py-6">
        <Link href={`/?cazare=${unit.id}`} className={`${pill} px-4 py-2.5`}>
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
        <ThemeToggle />
      </header>

      {/* Titlul paginii: gazda (pensiunea) și locul, deasupra pozelor */}
      <div className="mb-5 flex items-center gap-4 px-1">
        <Image src="/logo.png" alt="" width={56} height={56} className="size-14 shrink-0 rounded-full bg-cream-50 shadow-pill" />
        <div className="min-w-0">
          <p className="truncate font-serif text-2xl leading-tight text-ink sm:text-3xl">{unit.propertyName}</p>
          <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted">
            <MapPin className="size-4 shrink-0" />
            {unit.location}
            <span className="mx-1">·</span>
            {t("host")}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* ---------- Stânga ---------- */}
        <div className="min-w-0 space-y-5">
          <Hero photos={photos} name={unit.name} showAll={hasGallery}>
            <FavoriteButton unitId={base.id} name={unit.name} />
            <ShareButton />
          </Hero>

          <div className="min-w-0 px-1">
            <h1 className="font-serif text-4xl leading-tight text-ink">{unit.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
              <MapPin className="size-4" />
              {unit.location}
              {unit.rating !== null && (
                <>
                  <span className="mx-1">·</span>
                  <Star className="size-4 fill-star text-star" aria-hidden />
                  <span className="font-semibold text-ink" aria-label={tUnit("rating", { rating: unit.rating })}>
                    {unit.rating.toFixed(1)}
                  </span>
                </>
              )}
            </p>
          </div>

          <Section title={t("about")}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
              <Fact icon={BedDouble} text={tDetail("beds", { count: unit.beds })} />
              <Fact icon={Bath} text={tDetail("bathrooms", { count: unit.bathrooms })} />
              {unit.area !== null && <Fact icon={Ruler} text={tDetail("area", { area: unit.area })} />}
              <Fact icon={Users} text={tUnit("maxGuests", { count: unit.maxGuests })} />
            </ul>
            <p className="mt-4 leading-relaxed text-ink-soft">{unit.description}</p>
          </Section>

          {unit.amenities.length > 0 && (
            <Section title={t("tabs.amenities")}>
              <ul className="flex flex-wrap gap-2.5">
                {unit.amenities.map((a) => {
                  const Icon = amenityIcons[a];
                  return (
                    <li
                      key={a}
                      className="inline-flex items-center gap-2 rounded-full bg-cream-100 px-3.5 py-2 text-sm text-ink-soft shadow-pressed"
                    >
                      <Icon className="size-4 text-accent" strokeWidth={1.8} />
                      {tAmenity(a)}
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          <Section title={t("rules")}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {rules.map((rule) => (
                <li key={rule} className="flex items-center gap-3 text-sm text-ink-soft">
                  <CircleCheck className="size-5 shrink-0 text-accent" strokeWidth={1.8} />
                  {rule}
                </li>
              ))}
            </ul>
          </Section>

          {unit.lat !== null && unit.lng !== null && (
            <Section title={t("tabs.location")}>
              <MapCard location={unit.location} lat={unit.lat} lng={unit.lng} />
            </Section>
          )}
        </div>

        {/* ---------- Dreapta ---------- */}
        <div className="min-w-0 space-y-5">
          {hasGallery && photos.length > 1 && <SideGallery photos={photos} name={unit.name} />}

          <div className="lg:sticky lg:top-6">
            <PriceCard unit={unit} booking={booking} />
          </div>
        </div>
      </div>

      {/* useSearchParams cere un <Suspense> pe pagina statică; până se citește adresa nu afișăm nimic */}
      <Suspense fallback={null}>
        <UrlGallery photos={photos} name={unit.name} />
      </Suspense>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${card} p-5 lg:p-6`}>
      <h2 className={`${sectionTitle} border-b border-sand pb-3`}>{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Poza principală, mare: săgeți stânga / dreapta (și tastele ← →) schimbă poza pe loc, fără ecran
// complet; click pe poză o deschide pe tot ecranul. Peste ea: favorite, distribuie, „Vezi toate pozele".
function Hero({ photos, name, showAll, children }: { photos: string[]; name: string; showAll: boolean; children: ReactNode }) {
  const t = useTranslations("Property");
  const tDetail = useTranslations("Detail");
  const tGallery = useTranslations("Gallery");
  const [[index, dir], setState] = useState<[number, number]>([0, 0]);
  const many = photos.length > 1;
  const go = (step: number) => setState(([i]) => [(i + step + photos.length) % photos.length, step]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 200, damping: 26 }}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowLeft") go(-1);
        else if (e.key === "ArrowRight") go(1);
      }}
      aria-roledescription="carousel"
      className="group/hero relative h-72 overflow-hidden rounded-card bg-cream-100 shadow-soft sm:h-[26rem] lg:h-[30rem] 2xl:h-[34rem]"
    >
      <AnimatePresence initial={false} custom={dir}>
        <motion.button
          key={index}
          type="button"
          custom={dir}
          initial={{ opacity: 0, x: dir * 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -60 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => openPhoto(index)}
          aria-label={t("openPhoto", { index: index + 1 })}
          className="group absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent"
        >
          <Image
            src={photos[index]}
            alt={tDetail("photo", { index: index + 1, total: photos.length, name })}
            fill
            priority={index === 0}
            sizes="(min-width: 1024px) 66vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        </motion.button>
      </AnimatePresence>

      {many && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={tGallery("prev")}
            className={`${iconButton} absolute top-1/2 left-3 -translate-y-1/2 opacity-90 transition-opacity sm:opacity-0 sm:group-hover/hero:opacity-100 sm:focus-visible:opacity-100`}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={tGallery("next")}
            className={`${iconButton} absolute top-1/2 right-3 -translate-y-1/2 opacity-90 transition-opacity sm:opacity-0 sm:group-hover/hero:opacity-100 sm:focus-visible:opacity-100`}
          >
            <ChevronRight className="size-5" />
          </button>
          <span
            aria-live="polite"
            className="absolute right-3 bottom-3 rounded-full bg-[#0b1220]/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm"
          >
            {tGallery("counter", { index: index + 1, total: photos.length })}
          </span>
        </>
      )}

      <div className="absolute top-3 right-3 flex items-center gap-2">{children}</div>
      {showAll && (
        <button type="button" onClick={() => openPhoto(index)} className={`${pill} absolute bottom-3 left-3 px-4 py-2.5`}>
          <Images className="size-4" />
          {t("showAll")} · {photos.length}
        </button>
      )}
    </motion.section>
  );
}

// Restul pozelor, în coloana din dreapta: două mari alăturate, apoi un rând de miniaturi;
// ultima miniatură arată câte poze mai sunt („+5").
function SideGallery({ photos, name }: { photos: string[]; name: string }) {
  const t = useTranslations("Property");
  const tDetail = useTranslations("Detail");
  const big = photos.slice(1, 3);
  const thumbs = photos.slice(3, 7);
  const rest = photos.length - 7;

  const tile = (src: string, i: number, cls: string, sizes: string, more = 0) => (
    <button
      key={i}
      type="button"
      onClick={() => openPhoto(i)}
      aria-label={more > 0 ? `${t("showAll")} · ${photos.length}` : t("openPhoto", { index: i + 1 })}
      className={`group relative overflow-hidden rounded-inner shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${cls}`}
    >
      <Image
        src={src}
        alt={tDetail("photo", { index: i + 1, total: photos.length, name })}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
      />
      {more > 0 && (
        <span className="absolute inset-0 grid place-items-center bg-[#0b1220]/50 text-lg font-bold text-white">+{more}</span>
      )}
    </button>
  );

  return (
    <div className="space-y-2.5">
      <div className={`grid gap-2.5 ${big.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {big.map((src, k) => tile(src, k + 1, "h-40 xl:h-44", "220px"))}
      </div>
      {thumbs.length > 0 && (
        <div className="grid grid-cols-4 gap-2.5">
          {thumbs.map((src, k) => tile(src, k + 3, "aspect-square", "110px", k === thumbs.length - 1 && rest > 0 ? rest : 0))}
        </div>
      )}
    </div>
  );
}

// Cardul de preț: prețul pe noapte, apoi cererea de rezervare (datele, oaspeții, prețul calculat
// de bază pe nopți, datele de contact)
function PriceCard({ unit, booking }: { unit: Unit; booking: { today: IsoDate; busy: BusyRange[] } }) {
  const t = useTranslations("Property");
  const price = usePrice();

  return (
    <div className={`${card} p-5`}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-bold text-ink">{price(unit.pricePerNight)}</span>
        <span className="text-sm text-muted">/ {t("perNight")}</span>
      </p>
      <BookingCard unitId={unit.id} maxGuests={unit.maxGuests} today={booking.today} busy={booking.busy} />
    </div>
  );
}

// Distribuie: meniul nativ al telefonului, altfel copiază linkul (fără ?foto)
function ShareButton() {
  const t = useTranslations("Property");
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.origin + window.location.pathname;
    if (navigator.share) {
      await navigator.share({ title: document.title, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button type="button" onClick={share} className={iconButton} aria-label={copied ? t("copied") : t("share")}>
      {copied ? <Check className="size-4 text-accent" /> : <Share2 className="size-4" />}
    </button>
  );
}

function UrlGallery({ photos, name }: { photos: string[]; name: string }) {
  const n = Number(useSearchParams().get("foto") ?? NaN);
  const index = Number.isInteger(n) && n >= 0 && n < photos.length ? n : null;

  return (
    <AnimatePresence>
      {index !== null && (
        <Lightbox
          key="lightbox"
          photos={photos}
          name={name}
          index={index}
          onIndexChange={openPhoto}
          onClose={() => openPhoto(null)}
        />
      )}
    </AnimatePresence>
  );
}

function Fact({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <Icon className="size-4 text-accent" />
      {text}
    </li>
  );
}
