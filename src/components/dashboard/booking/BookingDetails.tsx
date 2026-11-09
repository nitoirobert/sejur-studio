"use client";

import { useOptimistic, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { pill, primaryButton } from "@/components/ui/soft";
import { diffDays } from "@/lib/dates/days";
import { fmt, formatMoney } from "../chart/format";
import { barKind, type ChartBooking } from "../chart/types";
import { timeLeft, type Decision } from "../requests/codes";
import { useNow } from "../requests/now";
import { useRespond } from "../requests/useRespond";
import { Sheet } from "./Sheet";

// Read-only details of one booking (click or Enter on a bar, or a row in "Sosiri următoare").
export function BookingDetails({
  booking,
  unitName,
  propertyName,
  onClose,
}: {
  booking: ChartBooking | null;
  unitName: string;
  propertyName: string;
  onClose: () => void;
}) {
  const t = useTranslations("Dashboard");
  const b = booking;
  // Blocked or imported (iCal) nights carry no guest and no amount: show where they come from instead.
  const blocked = b !== null && barKind(b) === "blocked";
  const heading = !b
    ? ""
    : !blocked
      ? b.guestName || t("chart.noGuest")
      : b.source === "direct"
        ? t("chart.statusLabel.blocked")
        : t("chart.blockedFrom", { source: t(`chart.source.${b.source}`) });
  return (
    <Sheet open={b !== null} onClose={onClose} title={t("details.title")} closeLabel={t("details.close")} testId="booking-details">
      {b && (
        <div data-booking-id={b.id}>
          <p data-testid="details-guest" className="text-lg font-semibold text-ink">
            {heading}
          </p>
          {!blocked && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <StatusChip booking={b} label={t(`chart.statusLabel.${statusKey(b)}`)} />
              <span>{t(`chart.source.${b.source}`)}</span>
            </p>
          )}

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-[15px]">
            <Item label={t("details.property")} value={propertyName} wide />
            <Item label={t("details.unit")} value={unitName} wide />
            <Item label={t("details.checkIn")} value={fmt.long(b.checkIn)} testId="details-check-in" />
            <Item label={t("details.checkOut")} value={fmt.long(b.checkOut)} testId="details-check-out" />
            <Item label={t("details.stay")} value={t("chart.nights", { count: diffDays(b.checkIn, b.checkOut) })} />
            {!blocked && (
              <Item
                label={t("details.guests")}
                value={`${t("details.adults", { count: b.adults })}, ${t("details.children", { count: b.children })}`}
              />
            )}
            {!blocked && (
              <Item
                label={t("details.total")}
                value={formatMoney(b.totalAmount, b.currency, t("kpi.currency"))}
                testId="details-total"
              />
            )}
            {b.status === "hold" && b.holdExpiresAt && (
              <Item label={t("details.holdUntil")} value={fmt.moment(b.holdExpiresAt)} />
            )}
          </dl>

          {b.status === "hold" && b.holdExpiresAt && !b.optimistic ? (
            <RequestActions key={b.id} bookingId={b.id} guest={b.guestName ?? ""} holdExpiresAt={b.holdExpiresAt} />
          ) : (
            <p className="mt-6 rounded-inner bg-cream-100/70 px-4 py-3 text-sm leading-relaxed text-ink-soft">
              {t("details.readOnly")}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}

function statusKey(b: ChartBooking): "confirmed" | "hold" | "blocked" {
  return b.status === "hold" ? "hold" : b.status === "blocked" ? "blocked" : "confirmed";
}

function StatusChip({ booking, label }: { booking: ChartBooking; label: string }) {
  const kind = barKind(booking);
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${
        kind === "confirmed" ? "bg-accent text-cream-50" : kind === "hold" ? "border border-dashed border-accent/60 bg-cream-50 text-ink" : "bg-sand-200 text-ink"
      }`}
    >
      {label}
    </span>
  );
}

function Item({ label, value, wide, testId }: { label: string; value: string; wide?: boolean; testId?: string }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</dt>
      <dd data-testid={testId} className="mt-1 text-ink first-letter:uppercase">
        {value}
      </dd>
    </div>
  );
}

// A live hold (request from the site): confirm or decline from the chart, the same action as the
// "De confirmat" list. Confirm: the action's refresh() turns the bar solid in the same response.
// Decline: the bar leaves the chart and the sheet closes with it.
function RequestActions({ bookingId, guest, holdExpiresAt }: { bookingId: string; guest: string; holdExpiresAt: string }) {
  const t = useTranslations("Dashboard");
  const { respond } = useRespond();
  const now = useNow();
  const [answering, setAnswering] = useOptimistic<Decision | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [expiredByServer, setExpiredByServer] = useState(false);
  const expired = expiredByServer || (now !== null && timeLeft(holdExpiresAt, now) === null);

  const inFlight = useRef(false);

  async function answer(decision: Decision) {
    if (inFlight.current) return; // a double click sends one request
    inFlight.current = true;
    setMessage(null);
    const r = await respond(bookingId, decision, () => setAnswering(decision));
    inFlight.current = false;
    if (r.ok) {
      setMessage({ tone: "ok", text: t(decision === "confirm" ? "requests.confirmed" : "requests.declined", { guest }) });
      return;
    }
    if (r.code === "hold_expired") setExpiredByServer(true);
    setMessage({ tone: "error", text: t(`requests.errors.${r.code}`) });
  }

  return (
    <div className="mt-6" data-testid="details-request">
      <p className="rounded-inner bg-cream-100/70 px-4 py-3 text-sm leading-relaxed text-ink-soft">
        {expired ? t("requests.errors.hold_expired") : t("requests.detailsHint")}
      </p>
      <div role="status" aria-live="polite" className="empty:hidden mt-3">
        {message && (
          <p data-testid="details-request-notice" data-tone={message.tone} className="text-[15px] font-medium text-ink">
            {message.text}
          </p>
        )}
      </div>
      {!expired && message?.tone !== "ok" && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="details-decline"
            disabled={answering !== null}
            onClick={() => answer("decline")}
            className={`${pill} h-11 justify-center px-5 disabled:pointer-events-none disabled:opacity-60`}
          >
            <X className="size-4" aria-hidden />
            {answering === "decline" ? t("requests.declining") : t("requests.decline")}
          </button>
          <button
            type="button"
            data-testid="details-confirm"
            disabled={answering !== null}
            onClick={() => answer("confirm")}
            className={`${primaryButton} h-11 px-5 py-0 text-[15px] disabled:pointer-events-none disabled:opacity-60`}
          >
            <Check className="size-4" aria-hidden />
            {answering === "confirm" ? t("requests.confirming") : t("requests.confirm")}
          </button>
        </div>
      )}
    </div>
  );
}
