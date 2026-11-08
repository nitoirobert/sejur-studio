"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  CalendarDays,
  Check,
  CircleCheck,
  Clock,
  Lock,
  MapPin,
  Ruler,
  Star,
  Users,
  X,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { nightly, property, type Unit } from "@/lib/mock-units";
import { card, iconButton, primaryButton, sectionTitle } from "@/components/ui/soft";
import { amenityIcons } from "./icons";
import { MapCard } from "./MapCard";
import { usePrice } from "./use-price";
import { GuestsEditor, useGuestsSummary } from "./GuestsEditor";
import { occupancy } from "@/lib/guests";
import type { Stay } from "./PropertyBrowser";

// Fluxul de rezervare are maximum 3 pași, apoi confirmarea
type Step = "details" | "guest" | "payment" | "done";
type Guest = { name: string; phone: string; email: string };

type Props = {
  unit: Unit;
  stay: Stay;
  onStayChange: (s: Stay) => void;
  onClose: () => void;
};

export function nightsBetween(from: string, to: string) {
  const ms = Date.parse(to) - Date.parse(from);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : 0;
}

export function UnitPanel({ unit, stay, onStayChange, onClose }: Props) {
  const t = useTranslations("Booking");
  const tDetail = useTranslations("Detail");
  const price = usePrice();
  const [step, setStep] = useState<Step>("details");
  const [guest, setGuest] = useState<Guest>({ name: "", phone: "", email: "" });
  const [paying, setPaying] = useState(false);
  const [scrolled, setScrolled] = useState(false); // titlul din corp a ieșit din vedere → apare mini-antetul
  const [code, setCode] = useState("");

  const nights = nightsBetween(stay.from, stay.to);
  const validDates = nights > 0;
  const canBook = validDates && occupancy(stay) <= unit.maxGuests;
  const total = nightly(unit) * Math.max(nights, 0);

  const back = () => setStep(step === "payment" ? "guest" : "details");

  // Plată simulată. Mai târziu: creăm hold-ul în DB + sesiunea Stripe Checkout și redirecționăm.
  const pay = () => {
    setPaying(true);
    setTimeout(() => {
      setCode(`VL-${Math.floor(1000 + Math.random() * 9000)}`);
      setPaying(false);
      setStep("done");
    }, 1200);
  };

  return (
    <article className={`${card} relative flex h-full flex-col overflow-hidden`}>
      <AnimatePresence>
        {step === "details" && scrolled && <MiniHeader key="mini" unit={unit} onClose={onClose} />}
      </AnimatePresence>
      {step !== "details" && step !== "done" && (
        <PanelTopBar step={step} onBack={back} onClose={onClose} />
      )}

      <div
        data-panel-scroll
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 260)}
        className="flex-1 overflow-x-hidden overflow-y-auto p-4"
      >
        {/* Fiecare pas intră din dreapta; la „Înapoi" pasul vechi iese spre stânga */}
        <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 28, filter: "blur(6px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: -28, filter: "blur(6px)" }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
        >
        {step === "details" && <DetailsView unit={unit} onClose={onClose} />}

        {step === "guest" && (
          <div className="space-y-5">
            <StaySummary unit={unit} stay={stay} nights={nights} />
            <form
              id="guest-form"
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setStep("payment");
              }}
            >
              <Field
                label={t("form.name")}
                placeholder={t("form.namePh")}
                autoComplete="name"
                value={guest.name}
                onChange={(name) => setGuest({ ...guest, name })}
              />
              <Field
                label={t("form.phone")}
                placeholder={t("form.phonePh")}
                type="tel"
                autoComplete="tel"
                value={guest.phone}
                onChange={(phone) => setGuest({ ...guest, phone })}
              />
              <Field
                label={t("form.email")}
                placeholder={t("form.emailPh")}
                type="email"
                autoComplete="email"
                value={guest.email}
                onChange={(email) => setGuest({ ...guest, email })}
              />
              <p className="flex items-start gap-2 pt-1 text-xs text-muted">
                <Lock className="mt-0.5 size-3.5 shrink-0" />
                {t("form.privacy")}
              </p>
            </form>
          </div>
        )}

        {step === "payment" && (
          <div className="space-y-4">
            <StaySummary unit={unit} stay={stay} nights={nights} />
            <div className="rounded-inner bg-cream-100 p-4 text-sm shadow-pressed">
              <p className="text-xs text-muted">{t("guestLabel")}</p>
              <p className="mt-1 font-semibold text-ink">{guest.name}</p>
              <p className="text-ink-soft">{guest.email}</p>
              <p className="text-ink-soft">{guest.phone}</p>
            </div>
            <PriceBreakdown unit={unit} nights={nights} />
            <p className="flex items-center gap-2 rounded-inner bg-accent-50 px-4 py-3 text-sm text-accent">
              <Clock className="size-4 shrink-0" />
              {t("hold")}
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center px-2 pt-8 text-center">
            <motion.span
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
              className="grid size-20 place-items-center rounded-full bg-accent text-cream-50 shadow-accent"
            >
              <Check className="size-10" strokeWidth={2.5} />
            </motion.span>
            <h2 className="mt-6 font-serif text-3xl">{t("doneTitle")}</h2>
            <p className="mt-2 max-w-xs text-sm text-ink-soft">
              {t("doneText", { email: guest.email })}
            </p>
            <p className="mt-6 rounded-full bg-cream-100 px-5 py-2 text-sm shadow-pressed">
              {t("code")}: <span className="font-bold tracking-wider text-ink">{code}</span>
            </p>
            <div className="mt-6 w-full text-left">
              <StaySummary unit={unit} stay={stay} nights={nights} />
            </div>
          </div>
        )}
        </motion.div>
        </AnimatePresence>
      </div>

      {/* Subsolul: prețul total + un singur buton principal, în fiecare pas */}
      <footer className="border-t border-sand bg-cream-100/70 p-4">
        {step === "details" && (
          <>
            <StayPicker unit={unit} stay={stay} onChange={onStayChange} />
            {!validDates && <p className="mt-2 text-xs text-red-700">{t("invalidDates")}</p>}
            <TotalRow
              label={tDetail("booking.total")}
              total={price(total)}
              note={
                validDates
                  ? tDetail("booking.nightsTimesPrice", {
                      price: price(nightly(unit)),
                      nights: tDetail("booking.nights", { count: nights }),
                    })
                  : ""
              }
            />
            <button
              type="button"
              disabled={!canBook}
              onClick={() => setStep("guest")}
              className={`${primaryButton} mt-3 w-full disabled:opacity-50`}
            >
              {tDetail("booking.cta")}
            </button>
          </>
        )}

        {step === "guest" && (
          <>
            <TotalRow label={tDetail("booking.total")} total={price(total)} note={tDetail("booking.noFees")} />
            <button type="submit" form="guest-form" className={`${primaryButton} mt-3 w-full`}>
              {t("continueToPayment")}
            </button>
          </>
        )}

        {step === "payment" && (
          <>
            <button
              type="button"
              onClick={pay}
              disabled={paying}
              className={`${primaryButton} w-full disabled:opacity-70`}
            >
              <Lock className="size-4" />
              {paying ? t("paying") : t("pay", { total: price(total) })}
            </button>
            <p className="mt-2 text-center text-xs text-muted">
              {t("secure")} {t("demo")}
            </p>
          </>
        )}

        {step === "done" && (
          <button type="button" onClick={onClose} className={`${primaryButton} w-full`}>
            {t("doneClose")}
          </button>
        )}
      </footer>
    </article>
  );
}

/* ---------- Pasul 1: detaliile unității ---------- */

type Tab = "overview" | "reviews" | "rules";

function DetailsView({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const t = useTranslations("Detail");
  const tUnit = useTranslations("Unit");
  const tAmenity = useTranslations("Amenities");
  const tBooking = useTranslations("Booking");
  const tProperty = useTranslations("Property");
  const price = usePrice();
  const [tab, setTab] = useState<Tab>("overview");
  const locationRef = useRef<HTMLElement>(null);

  // Indiciu că mai e ceva de văzut: după 3 secunde, panoul coboară singur, foarte lin, spre hartă.
  // Se oprește imediat dacă utilizatorul atinge/derulează el, și rulează o singură dată per unitate.
  useEffect(() => {
    if (tab !== "overview") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = locationRef.current;
    const scroller = target?.closest<HTMLElement>("[data-panel-scroll]");
    if (!target || !scroller) return;

    let raf = 0;
    let stopped = false;
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
    const events = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    events.forEach((e) => scroller.addEventListener(e, stop, { passive: true }));

    const timer = window.setTimeout(() => {
      if (stopped || scroller.scrollTop > 8) return; // a derulat deja el
      // țintă: titlul „Locație" ajunge la ~45% din înălțimea panoului, deci harta se vede
      const delta =
        target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientHeight * 0.45;
      if (delta < 24) return;
      const from = scroller.scrollTop;
      const duration = 1800;
      const t0 = performance.now();
      const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // încet–rapid–încet
      const step = (now: number) => {
        if (stopped) return;
        const x = Math.min(1, (now - t0) / duration);
        scroller.scrollTop = from + delta * ease(x);
        if (x < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, 3000);

    return () => {
      window.clearTimeout(timer);
      stop();
      events.forEach((e) => scroller.removeEventListener(e, stop));
    };
  }, [tab]);

  return (
    <>
      <div className="relative grid h-60 grid-cols-3 grid-rows-2 gap-2">
        {/* Click pe o poză → pagina dedicată a cazării, cu galeria deschisă pe tot ecranul la poza aleasă */}
        {unit.photos.slice(0, 3).map((src, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 1.08, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ type: "spring", stiffness: 200, damping: 26, delay: 0.08 + i * 0.07 }}
            className={`relative overflow-hidden rounded-inner ${i === 0 ? "col-span-2 row-span-2" : ""}`}
          >
            <Link
              href={`/cazare/${unit.id}?foto=${i}`}
              aria-label={tProperty("openPhoto", { index: i + 1 })}
              className="group absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <Image
                src={src}
                alt={t("photo", { index: i + 1, total: unit.photos.length, name: unit.name })}
                fill
                sizes={i === 0 ? "320px" : "160px"}
                className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            </Link>
          </motion.div>
        ))}
        <button
          type="button"
          onClick={onClose}
          className={`${iconButton} absolute top-3 left-3`}
          aria-label={tBooking("close")}
        >
          <X className="size-4" />
        </button>
      </div>

      <header className="flex items-start justify-between gap-3 pt-5">
        <div className="min-w-0">
          <h2 className="font-serif text-2xl leading-tight">{unit.name}</h2>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted">
            <MapPin className="size-3.5" />
            {unit.location}
            <span className="mx-1">·</span>
            <Star className="size-3.5 fill-star text-star" />
            <span className="font-semibold text-ink">{unit.rating.toFixed(1)}</span>
          </p>
          {unit.offer && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-star px-2.5 py-1 text-xs font-bold text-ink shadow-pill">
              {tUnit("discount", { percent: unit.offer.percent })} · {tUnit(`offers.${unit.offer.label}`)}
            </span>
          )}
        </div>
        <p className="shrink-0 text-right">
          {unit.offer && (
            <span className="block text-xs text-muted line-through">{price(unit.pricePerNight)}</span>
          )}
          <span className="block text-xl font-bold">{price(nightly(unit))}</span>
          <span className="text-xs text-muted">{tUnit("perNight")}</span>
        </p>
      </header>

      <div role="tablist" className="mt-5 flex rounded-full bg-cream-100 p-1 shadow-pressed">
        {(["overview", "reviews", "rules"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-full py-2 text-sm transition ${
              tab === key
                ? "bg-cream-50 font-semibold text-ink shadow-pill"
                : "font-medium text-ink-soft hover:text-ink"
            }`}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="pt-5">
        {tab === "overview" && (
          <div className="space-y-6">
            <p className="text-sm leading-relaxed text-ink-soft">{unit.description}</p>

            <section>
              <h3 className={sectionTitle}>{t("space")}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <Fact icon={<BedDouble className="size-4" />} text={t("beds", { count: unit.beds })} />
                <Fact icon={<Bath className="size-4" />} text={t("bathrooms", { count: unit.bathrooms })} />
                <Fact icon={<Ruler className="size-4" />} text={t("area", { area: unit.area })} />
                <Fact icon={<Users className="size-4" />} text={tUnit("maxGuests", { count: unit.maxGuests })} />
              </div>
            </section>

            <section>
              <h3 className={sectionTitle}>{t("amenities")}</h3>
              <ul className="mt-3 grid grid-cols-4 gap-x-2 gap-y-4">
                {unit.amenities.map((a) => {
                  const Icon = amenityIcons[a];
                  return (
                    <li key={a} className="flex flex-col items-center gap-2 text-center">
                      <span className="grid size-14 place-items-center rounded-full bg-cream-50 text-accent shadow-pill">
                        <Icon className="size-6" strokeWidth={1.8} />
                      </span>
                      <span className="text-[11px] leading-tight font-medium text-ink-soft">
                        {tAmenity(a)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section ref={locationRef}>
              <h3 className={sectionTitle}>{t("location")}</h3>
              <div className="mt-3">
                <MapCard location={unit.location} lat={unit.lat} lng={unit.lng} />
              </div>
            </section>
          </div>
        )}

        {tab === "reviews" && (
          <p className="rounded-inner bg-cream-100 p-5 text-sm text-ink-soft shadow-pressed">
            {t("reviewsSoon")}
          </p>
        )}

        {tab === "rules" && (
          <ul className="space-y-3 text-sm text-ink-soft">
            {[
              t("rules.checkIn", { time: property.checkIn }),
              t("rules.checkOut", { time: property.checkOut }),
              t("rules.noSmoking"),
              t("rules.quiet"),
            ].map((rule) => (
              <li key={rule} className="flex items-center gap-3 rounded-inner bg-cream-100 px-4 py-3 shadow-pressed">
                <CircleCheck className="size-4 text-accent" />
                {rule}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* ---------- Componente mici ---------- */

function PanelTopBar({
  step,
  onBack,
  onClose,
}: {
  step: "guest" | "payment";
  onBack: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("Booking");
  const current = step === "guest" ? 2 : 3;
  const steps = ["details", "guest", "payment"] as const;

  return (
    <div className="border-b border-sand px-4 pt-4 pb-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className={iconButton} aria-label={t("back")}>
          <ArrowLeft className="size-4" />
        </button>
        <p className="text-sm font-semibold text-ink">{t("stepOf", { step: current })}</p>
        <button type="button" onClick={onClose} className={iconButton} aria-label={t("close")}>
          <X className="size-4" />
        </button>
      </div>
      <ol className="mt-3 grid grid-cols-3 gap-2">
        {steps.map((s, i) => (
          <li key={s} className="space-y-1.5">
            <span
              className={`block h-1.5 rounded-full ${i < current ? "bg-accent" : "bg-sand-200"}`}
            />
            <span
              className={`block text-[11px] font-medium ${i < current ? "text-ink" : "text-muted"}`}
            >
              {t(`steps.${s}`)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StayPicker({
  unit,
  stay,
  onChange,
}: {
  unit: Unit;
  stay: Stay;
  onChange: (s: Stay) => void;
}) {
  const t = useTranslations("Booking");
  const box = "rounded-2xl bg-cream-50 px-3 py-2 shadow-pill";
  const input =
    "mt-0.5 w-full bg-transparent text-sm font-semibold text-ink outline-none [color-scheme:light]";

  return (
    <div className="grid grid-cols-2 gap-2">
      <label className={box}>
        <span className="text-[11px] font-medium text-muted">{t("checkIn")}</span>
        <input
          type="date"
          className={input}
          value={stay.from}
          onChange={(e) => onChange({ ...stay, from: e.target.value })}
        />
      </label>
      <label className={box}>
        <span className="text-[11px] font-medium text-muted">{t("checkOut")}</span>
        <input
          type="date"
          className={input}
          value={stay.to}
          min={stay.from}
          onChange={(e) => onChange({ ...stay, to: e.target.value })}
        />
      </label>
      <div className={`${box} col-span-2`}>
        <span className="mb-2 block text-[11px] font-medium text-muted">{t("guests")}</span>
        <GuestsEditor value={stay} onChange={(g) => onChange({ ...stay, ...g })} capacity={unit.maxGuests} compact />
      </div>
    </div>
  );
}

function TotalRow({ label, total, note }: { label: string; total: string; note: string }) {
  return (
    <div className="mt-3 flex items-end justify-between gap-3">
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-2xl font-bold text-ink">{total}</p>
      </div>
      <p className="pb-1 text-right text-xs text-muted">{note}</p>
    </div>
  );
}

function StaySummary({ unit, stay, nights }: { unit: Unit; stay: Stay; nights: number }) {
  const summary = useGuestsSummary();
  const tDetail = useTranslations("Detail");
  const format = useFormatter();
  const opts = { day: "numeric", month: "short" } as const;

  return (
    <div className="flex gap-3 rounded-inner bg-cream-100 p-3 shadow-pressed">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl">
        <Image src={unit.photos[0]} alt="" fill sizes="80px" className="object-cover" />
      </div>
      <div className="min-w-0 text-sm">
        <p className="truncate font-semibold text-ink">{unit.name}</p>
        <p className="mt-1 flex items-center gap-1.5 text-ink-soft">
          <CalendarDays className="size-3.5 text-accent" />
          {format.dateTime(new Date(stay.from), opts)} – {format.dateTime(new Date(stay.to), opts)}
          <span className="text-muted">· {tDetail("booking.nights", { count: nights })}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-ink-soft">
          <Users className="size-3.5 text-accent" />
          {summary(stay)}
        </p>
      </div>
    </div>
  );
}

function PriceBreakdown({ unit, nights }: { unit: Unit; nights: number }) {
  const tDetail = useTranslations("Detail");
  const tUnit = useTranslations("Unit");
  const price = usePrice();
  const full = unit.pricePerNight * nights;
  const total = nightly(unit) * nights;
  return (
    <div className="space-y-2 rounded-inner bg-cream-100 p-4 text-sm shadow-pressed">
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
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink">{label}</span>
      <input
        required
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink shadow-pressed outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent/60"
      />
    </label>
  );
}

function Fact({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-cream-50 px-3.5 py-2 text-sm font-medium text-ink shadow-pill">
      <span className="text-accent">{icon}</span>
      {text}
    </span>
  );
}

/*
  Mini-antet: stă deasupra zonei derulabile, deci butonul X rămâne mereu în stânga sus.
  După ce derulezi, în locul textului „Detalii cazare" apar numele, ratingul și prețul unității.
*/
function MiniHeader({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const t = useTranslations("Booking");
  const tUnit = useTranslations("Unit");
  const price = usePrice();

  return (
    <motion.div
      initial={{ y: "-100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "-100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 rounded-t-card border-b border-sand bg-cream-50/95 px-4 py-3 shadow-pill backdrop-blur"
    >
      <button type="button" onClick={onClose} className={`${iconButton} size-10`} aria-label={t("close")}>
        <X className="size-4" />
      </button>
      {/* Poza unității, mică, cu bordură */}
      <div className="relative size-12 shrink-0 overflow-hidden rounded-2xl border-2 border-cream-50 shadow-pill ring-1 ring-sand">
        <Image src={unit.photos[0]} alt="" fill sizes="48px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-serif text-xl leading-tight text-ink">{unit.name}</h2>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{unit.location}</span>
          <span className="mx-0.5">·</span>
          <Star className="size-3.5 shrink-0 fill-star text-star" aria-hidden />
          <span className="font-semibold text-ink" aria-label={tUnit("rating", { rating: unit.rating })}>
            {unit.rating.toFixed(1)}
          </span>
        </p>
      </div>
      <p className="shrink-0 text-right">
        <span className="block text-base leading-tight font-bold text-ink">{price(nightly(unit))}</span>
        <span className="text-[11px] text-muted">{tUnit("perNightShort")}</span>
      </p>
    </motion.div>
  );
}
