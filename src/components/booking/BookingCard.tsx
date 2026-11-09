"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { primaryButton } from "@/components/ui/soft";
import { GuestsEditor } from "@/components/browse/GuestsEditor";
import { usePrice } from "@/components/browse/use-price";
import { addDays, diffDays, isoToDate, type IsoDate } from "@/lib/dates/days";
import type { GuestCounts } from "@/lib/guests";
import { getQuote, requestBooking, type QuoteResult } from "@/lib/booking/actions";
import { PHONE_RE, type BookingError } from "@/lib/booking/schema";

export type BusyRange = { from: IsoDate; to: IsoDate }; // [from, to)

type Props = {
  unitId: string;
  maxGuests: number;
  today: IsoDate; // Europe/Bucharest, from the server
  busy: BusyRange[];
};

const overlaps = (from: IsoDate, to: IsoDate, b: BusyRange) => from < b.to && to > b.from;

// First free 2-night stay from tomorrow on, so the form opens with a real price.
function firstFree(today: IsoDate, busy: BusyRange[]): { from: IsoDate; to: IsoDate } {
  let from = addDays(today, 1);
  for (let i = 0; i < 400; i++) {
    const to = addDays(from, 2);
    const hit = busy.find((b) => overlaps(from, to, b));
    if (!hit) return { from, to };
    from = hit.to > from ? hit.to : addDays(from, 1);
  }
  return { from: addDays(today, 1), to: addDays(today, 3) };
}

/*
  Booking request on /cazare/[id]: dates, guests, the price computed by the database for those
  nights (public_quote), then name, email and phone. It is a request: the host confirms within
  24 hours. The browser never sends a price.
*/
export function BookingCard({ unitId, maxGuests, today, busy }: Props) {
  const t = useTranslations("BookingRequest");
  const format = useFormatter();
  const price = usePrice();
  const router = useRouter();
  const ids = useId();

  const [stay, setStay] = useState(() => firstFree(today, busy));
  const [guests, setGuests] = useState<GuestCounts>({ guests: Math.min(2, maxGuests), kids: 0, infants: 0 });
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoting, setQuoting] = useState(true);
  const [step, setStep] = useState<"stay" | "contact">("stay");
  const [contact, setContact] = useState({ fullName: "", email: "", phone: "" });
  const [error, setError] = useState<BookingError | null>(null);
  const [sending, startSending] = useTransition();
  const sent = useRef(false); // one request per page, even with a double click or Enter twice
  const [locked, setLocked] = useState(false);

  const day = (d: IsoDate) => format.dateTime(isoToDate(d), { day: "numeric", month: "short", timeZone: "UTC" });
  const datesValid = stay.to > stay.from;
  const clash = datesValid ? busy.find((b) => overlaps(stay.from, stay.to, b)) : undefined;

  // Price for the chosen stay; the latest request wins.
  useEffect(() => {
    if (!datesValid) return;
    let live = true;
    const timer = window.setTimeout(() => {
      setQuoting(true);
      getQuote({ unitId, checkIn: stay.from, checkOut: stay.to, adults: guests.guests, children: guests.kids })
        .then((q) => live && setQuote(q))
        .catch(() => live && setQuote({ ok: false, code: "generic" }))
        .finally(() => live && setQuoting(false));
    }, 200);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [unitId, stay.from, stay.to, guests.guests, guests.kids, datesValid]);

  const changeFrom = (from: string) => {
    if (!from) return;
    setError(null);
    setStay((s) => ({ from, to: s.to > from ? s.to : addDays(from, Math.max(1, diffDays(s.from, s.to))) }));
  };
  const changeTo = (to: string) => {
    if (!to) return;
    setError(null);
    setStay((s) => ({ ...s, to }));
  };

  const quoteError: BookingError | null = !datesValid
    ? "invalid_dates"
    : clash
      ? "unavailable"
      : quote && !quote.ok
        ? quote.code
        : null;
  const canContinue = !quoting && !quoteError && quote?.ok === true;

  const contactValid =
    contact.fullName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()) &&
    PHONE_RE.test(contact.phone.trim());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === "stay") {
      if (canContinue) setStep("contact");
      return;
    }
    if (sent.current || !contactValid) {
      if (!contactValid) setError("invalid_guest");
      return;
    }
    sent.current = true;
    setLocked(true);
    setError(null);
    startSending(async () => {
      try {
        const r = await requestBooking({
          unitId,
          checkIn: stay.from,
          checkOut: stay.to,
          adults: guests.guests,
          children: guests.kids,
          fullName: contact.fullName,
          email: contact.email,
          phone: contact.phone,
        });
        if (r.ok) {
          router.push(`/rezervare/${r.token}`);
          return; // the button stays disabled until the status page opens
        }
        sent.current = false;
        setLocked(false);
        setError(r.code);
        if (["unavailable", "invalid_dates", "too_many_guests", "min_nights", "no_price"].includes(r.code)) setStep("stay");
      } catch {
        sent.current = false;
        setLocked(false);
        setError("generic");
      }
    });
  };

  const field = "w-full rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink shadow-pressed outline-none focus-visible:outline-2 focus-visible:outline-accent";
  const shownError = error ?? (step === "stay" ? quoteError : null);
  const upcoming = busy.filter((b) => b.to > today).slice(0, 4);

  return (
    <form onSubmit={submit} noValidate className="mt-4 space-y-4" aria-busy={quoting || sending}>
      <fieldset disabled={step === "contact"} className="space-y-4">
        <legend className="sr-only">{t("stayLegend")}</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
              <CalendarDays className="size-3.5 text-accent" aria-hidden />
              {t("checkIn")}
            </span>
            <input
              type="date"
              value={stay.from}
              min={today}
              onChange={(e) => changeFrom(e.target.value)}
              className={field}
              name="checkIn"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
              <CalendarDays className="size-3.5 text-accent" aria-hidden />
              {t("checkOut")}
            </span>
            <input
              type="date"
              value={stay.to}
              min={addDays(stay.from, 1)}
              onChange={(e) => changeTo(e.target.value)}
              className={field}
              name="checkOut"
            />
          </label>
        </div>

        {upcoming.length > 0 && (
          <p className="text-xs text-muted" data-testid="busy-days">
            {t("busy")}{" "}
            {upcoming.map((b) => `${day(b.from)} – ${day(b.to)}`).join(", ")}
          </p>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold text-muted">{t("guests", { max: maxGuests })}</p>
          <GuestsEditor value={guests} onChange={(g) => (setError(null), setGuests(g))} capacity={maxGuests} compact />
        </div>
      </fieldset>

      <div className="space-y-2 border-t border-sand pt-4 text-sm" aria-live="polite">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t("priceTitle")}</p>
        {quoting && !quote ? (
          <p className="flex items-center gap-2 text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("quoting")}
          </p>
        ) : quote?.ok && !quoteError ? (
          <>
            <ul className={`space-y-1 ${quoting ? "opacity-60" : ""}`} data-testid="nightly">
              {quote.nightly.map(([d, amount]) => (
                <li key={d} className="flex justify-between text-ink-soft">
                  <span>{t("night", { date: day(d) })}</span>
                  <span>{price(amount)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-sand pt-2 font-bold text-ink">
              <span>{t("total", { count: quote.nights })}</span>
              <span data-testid="quote-total">{price(quote.total)}</span>
            </div>
          </>
        ) : null}
      </div>

      {step === "contact" && (
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-semibold text-ink">{t("contactLegend")}</legend>
          {(
            [
              ["fullName", "text", "name", t("fullName")],
              ["email", "email", "email", t("email")],
              ["phone", "tel", "tel", t("phone")],
            ] as const
          ).map(([key, type, auto, label]) => (
            <label key={key} className="block" htmlFor={`${ids}-${key}`}>
              <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
              <input
                id={`${ids}-${key}`}
                type={type}
                name={key}
                autoComplete={auto}
                required
                maxLength={key === "phone" ? 32 : key === "email" ? 254 : 80}
                value={contact[key]}
                onChange={(e) => {
                  setError(null);
                  setContact((c) => ({ ...c, [key]: e.target.value }));
                }}
                className={field}
              />
            </label>
          ))}
          <p className="text-xs text-muted">{t("requestNote")}</p>
        </fieldset>
      )}

      {shownError && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800" data-testid="booking-error">
          {t(`errors.${shownError}`, { max: maxGuests })}
        </p>
      )}

      <button
        type="submit"
        className={`${primaryButton} w-full disabled:cursor-not-allowed disabled:opacity-60`}
        disabled={step === "stay" ? !canContinue : sending || locked}
      >
        {sending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("sending")}
          </>
        ) : step === "stay" ? (
          t("continue")
        ) : (
          t("send")
        )}
      </button>
      {step === "contact" && (
        <button
          type="button"
          onClick={() => setStep("stay")}
          disabled={sending}
          className="w-full text-center text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          {t("changeStay")}
        </button>
      )}
      <p className="text-center text-xs text-muted">{t("noPayment")}</p>
    </form>
  );
}
