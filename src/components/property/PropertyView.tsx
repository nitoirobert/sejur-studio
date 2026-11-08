"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  CalendarDays,
  Check,
  CircleCheck,
  Images,
  MapPin,
  Pencil,
  Ruler,
  Share2,
  Star,
  Users,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { defaultStay, nightly, property, type Unit } from "@/lib/mock-units";
import { card, iconButton, pill, primaryButton } from "@/components/ui/soft";
import { amenityIcons } from "@/components/browse/icons";
import { MapCard } from "@/components/browse/MapCard";
import { ThemeToggle } from "@/components/browse/ThemeToggle";
import { usePrice } from "@/components/browse/use-price";
import { useLocalizeUnit } from "@/lib/use-units";
import { Lightbox } from "./Lightbox";

// Poza deschisă stă în adresă (?foto=n): linkul din panou și cel copiat duc la aceeași poză.
// history.replaceState e sincronizat de Next cu useSearchParams, fără cerere la server.
function openPhoto(i: number | null) {
  const url = new URL(window.location.href);
  if (i === null) url.searchParams.delete("foto");
  else url.searchParams.set("foto", String(i));
  window.history.replaceState(null, "", url);
}

type Tab = "amenities" | "rules" | "location";

// Pagina dedicată a unei cazări, după referința „Homex": bară sus, pozele într-un rând (toate la fel),
// apoi detaliile în stânga și cardul de preț în dreapta.
export function PropertyView({ unit: base }: { unit: Unit }) {
  const unit = useLocalizeUnit()(base); // numele și descrierea în limba aleasă
  const t = useTranslations("Property");
  const tDetail = useTranslations("Detail");
  const tUnit = useTranslations("Unit");
  const tAmenity = useTranslations("Amenities");
  const [tab, setTab] = useState<Tab>("amenities");
  const photos = unit.photos;

  return (
    // Pagina e mai îngustă decât restul site-ului (cerut de Robert): ca panoul din dreapta, doar mai mare.
    // Stânga: pozele (rămân pe loc la derulare). Dreapta: informațiile și rezervarea.
    <div className="mx-auto flex w-full max-w-[1320px] flex-col px-4 pb-16 lg:px-6">
      <header className="flex items-center justify-between gap-4 py-6">
        <Link href={`/?cazare=${unit.id}`} className={`${pill} px-4 py-2.5`}>
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
        <div className="flex items-center gap-2">
          <ShareButton />
          <ThemeToggle />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] xl:grid-cols-[minmax(0,1fr)_480px]">
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Gallery photos={photos} name={unit.name} />
          <div className={`${card} flex items-center gap-3 p-4`}>
            <Image src="/logo.png" alt="" width={48} height={48} className="size-12 rounded-full shadow-pill" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{property.name}</p>
              <p className="text-xs text-muted">{t("host")}</p>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className={`${card} p-5 lg:p-7`}>
            <h1 className="font-serif text-4xl leading-tight text-ink">{unit.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
              <MapPin className="size-4" />
              {unit.location}
              <span className="mx-1">·</span>
              <Star className="size-4 fill-star text-star" aria-hidden />
              <span className="font-semibold text-ink" aria-label={tUnit("rating", { rating: unit.rating })}>
                {unit.rating.toFixed(1)}
              </span>
            </p>

            {/* Faptele principale, pe un rând, ca în referință */}
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-b border-sand pb-5 text-sm text-ink-soft">
              <Fact icon={BedDouble} text={tDetail("beds", { count: unit.beds })} />
              <Fact icon={Bath} text={tDetail("bathrooms", { count: unit.bathrooms })} />
              <Fact icon={Ruler} text={tDetail("area", { area: unit.area })} />
              <Fact icon={Users} text={tUnit("maxGuests", { count: unit.maxGuests })} />
            </ul>

            <p className="mt-5 leading-relaxed text-ink-soft">{unit.description}</p>

            {/* File: Facilități / Reguli / Locație, subliniate ca în referință */}
            <div role="tablist" className="mt-8 flex gap-6 border-b border-sand">
              {(["amenities", "rules", "location"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`-mb-px border-b-2 pb-3 text-sm transition-colors ${
                    tab === key
                      ? "border-accent font-semibold text-ink"
                      : "border-transparent font-medium text-muted hover:text-ink"
                  }`}
                >
                  {t(`tabs.${key}`)}
                </button>
              ))}
            </div>

            <div role="tabpanel" className="pt-6">
              {tab === "amenities" && (
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-6 gap-y-4">
                  {unit.amenities.map((a) => {
                    const Icon = amenityIcons[a];
                    return (
                      <li key={a} className="flex items-center gap-3 text-sm text-ink-soft">
                        <Icon className="size-5 text-accent" strokeWidth={1.8} />
                        {tAmenity(a)}
                      </li>
                    );
                  })}
                </ul>
              )}

              {tab === "rules" && (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {[
                    tDetail("rules.checkIn", { time: property.checkIn }),
                    tDetail("rules.checkOut", { time: property.checkOut }),
                    tDetail("rules.noSmoking"),
                    tDetail("rules.quiet"),
                  ].map((rule) => (
                    <li key={rule} className="flex items-center gap-3 text-sm text-ink-soft">
                      <CircleCheck className="size-5 text-accent" strokeWidth={1.8} />
                      {rule}
                    </li>
                  ))}
                </ul>
              )}

              {tab === "location" && <MapCard location={unit.location} lat={unit.lat} lng={unit.lng} />}
            </div>
          </div>
          <PriceCard unit={unit} />
        </div>
      </div>

      {/* useSearchParams cere un <Suspense> pe pagina statică; până se citește adresa nu afișăm nimic */}
      <Suspense fallback={null}>
        <UrlGallery photos={photos} name={unit.name} />
      </Suspense>
    </div>
  );
}

/*
  Pozele, în același model ca în panoul din dreapta: una mare în stânga (2/3) și două una sub alta
  în dreapta (1/3), doar că secțiunea e mai înaltă.
*/
function Gallery({ photos, name }: { photos: string[]; name: string }) {
  const t = useTranslations("Property");
  const tDetail = useTranslations("Detail");
  const shown = photos.slice(0, 3);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 200, damping: 26 }}
      className="relative"
    >
      <div
        className={`grid h-72 gap-2 sm:h-96 sm:gap-3 lg:h-[28rem] 2xl:h-[32rem] ${
          shown.length > 1 ? "grid-cols-3 grid-rows-2" : "grid-cols-1"
        }`}
      >
        {shown.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => openPhoto(i)}
            aria-label={t("openPhoto", { index: i + 1 })}
            className={`group relative overflow-hidden rounded-inner shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              i === 0 && shown.length > 1 ? "col-span-2 row-span-2" : ""
            } ${shown.length === 2 && i === 1 ? "row-span-2" : ""}`}
          >
            <Image
              src={src}
              alt={tDetail("photo", { index: i + 1, total: photos.length, name })}
              fill
              priority={i === 0}
              sizes={i === 0 ? "66vw" : "33vw"}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => openPhoto(0)}
        className={`${pill} absolute right-3 bottom-3 px-4 py-2.5`}
      >
        <Images className="size-4" />
        {t("showAll")} · {photos.length}
      </button>
    </motion.section>
  );
}

// Cardul de preț: prețul pe noapte, sejurul implicit și calculul, apoi butonul de rezervare
function PriceCard({ unit }: { unit: Unit }) {
  const t = useTranslations("Property");
  const tDetail = useTranslations("Detail");
  const tUnit = useTranslations("Unit");
  const price = usePrice();
  const format = useFormatter();
  const nights = defaultStay.nights;
  const full = unit.pricePerNight * nights;
  const total = nightly(unit) * nights;
  const date = (d: string) => format.dateTime(new Date(d), { day: "numeric", month: "short" });

  return (
    <div className={`${card} p-5`}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-bold text-ink">{price(nightly(unit))}</span>
        <span className="text-sm text-muted">/ {t("perNight")}</span>
        {unit.offer && <span className="text-sm text-muted line-through">{price(unit.pricePerNight)}</span>}
      </p>
      {unit.offer && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-star px-2.5 py-1 text-xs font-bold text-ink shadow-pill">
          {tUnit("discount", { percent: unit.offer.percent })} · {tUnit(`offers.${unit.offer.label}`)}
        </span>
      )}

      <Link
        href={`/?cazare=${unit.id}`}
        className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-cream-100 px-4 py-3 text-sm shadow-pressed transition-colors hover:bg-cream-200"
        aria-label={t("editStay")}
      >
        <span className="flex items-center gap-2 text-ink">
          <CalendarDays className="size-4 text-accent" />
          <span className="text-muted">{t("stay")}:</span>
          <span className="font-semibold">
            {date(defaultStay.from)} – {date(defaultStay.to)}
          </span>
        </span>
        <Pencil className="size-4 text-muted" />
      </Link>

      <Link href={`/?cazare=${unit.id}`} className={`${primaryButton} mt-4 w-full`}>
        {t("book")}
      </Link>

      <div className="mt-5 space-y-2 border-t border-sand pt-4 text-sm">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t("fees")}</p>
        <div className="flex justify-between text-ink-soft">
          <span>
            {tDetail("booking.nightsTimesPrice", {
              price: price(unit.pricePerNight),
              nights: tDetail("booking.nights", { count: nights }),
            })}
          </span>
          <span>{price(full)}</span>
        </div>
        {unit.offer && (
          <div className="flex justify-between font-medium text-accent">
            <span>
              {tDetail("booking.discountRow", {
                label: tUnit(`offers.${unit.offer.label}`),
                percent: unit.offer.percent,
              })}
            </span>
            <span>−{price(full - total)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-sand pt-2 font-bold text-ink">
          <span>{tDetail("booking.total")}</span>
          <span>{price(total)}</span>
        </div>
        <p className="pt-1 text-center text-xs text-muted">{tDetail("booking.noFees")}</p>
      </div>
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
