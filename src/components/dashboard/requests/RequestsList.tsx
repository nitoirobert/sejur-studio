"use client";

import { useEffect, useOptimistic, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, ChevronLeft, ChevronRight, Mail, Phone, X } from "lucide-react";
import { pill, primaryButton } from "@/components/ui/soft";
import { diffDays, type IsoDate } from "@/lib/dates/days";
import { fmt, formatMoney } from "../chart/format";
import { usePendingBadge } from "./badge";
import { timeLeft, type Decision, type RequestErrorCode } from "./codes";
import { useNow } from "./now";
import { useRespond } from "./useRespond";

export type PendingRequest = {
  id: string;
  unitName: string;
  propertyName: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
  adults: number;
  children: number;
  totalAmount: number; // bani
  currency: string;
  holdExpiresAt: string;
  createdAt: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
};

type Notice = { tone: "ok" | "error"; text: string };

const panel = "rounded-card border border-glass-line bg-glass shadow-glass backdrop-blur-xl backdrop-saturate-150";

/*
  "De confirmat": live holds of the owner's organizations, most urgent first, server-paginated.
  A click disables the row at once (optimistic) and drops the badge by one; the action's refresh()
  brings the new list in the same response. hold_expired keeps the row, marked "Expirată".
*/
export function RequestsList({
  rows,
  total,
  page,
  pages,
}: {
  rows: PendingRequest[];
  total: number;
  page: number;
  pages: number;
}) {
  const t = useTranslations("Dashboard");
  const badge = usePendingBadge();
  const { respond } = useRespond();
  const now = useNow();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [expired, setExpired] = useState<ReadonlySet<string>>(() => new Set());
  const [answering, markAnswering] = useOptimistic<Record<string, Decision>, [string, Decision]>(
    {},
    (state, [id, decision]) => ({ ...state, [id]: decision }),
  );
  const inFlight = useRef(new Set<string>());
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The list total is the badge's number (same predicate); a new server list resets it.
  const set = badge?.set;
  useEffect(() => {
    set?.(total);
  }, [rows, total, set]);

  async function answer(r: PendingRequest, decision: Decision) {
    if (inFlight.current.has(r.id)) return; // a double click sends one request
    inFlight.current.add(r.id);
    setNotice(null);
    const result = await respond(r.id, decision, () => markAnswering([r.id, decision]));
    inFlight.current.delete(r.id);
    if (result.ok) {
      setNotice({ tone: "ok", text: t(decision === "confirm" ? "requests.confirmed" : "requests.declined", { guest: r.guestName }) });
      headingRef.current?.focus(); // the row is gone; keep focus in the list
      return;
    }
    if (result.code === "hold_expired") setExpired((s) => new Set(s).add(r.id));
    setNotice({ tone: "error", text: errorText(result.code) });
  }

  const errorText = (code: RequestErrorCode) => t(`requests.errors.${code}`);

  return (
    <section aria-labelledby="requests-title" data-testid="requests" className={`${panel} p-4 sm:p-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="requests-title" ref={headingRef} tabIndex={-1} className="font-serif text-2xl leading-tight text-ink outline-none">
          {t("requests.title")}
        </h2>
        <p data-testid="requests-total" data-count={total} className="text-sm font-medium text-ink-soft">
          {t("requests.count", { count: total })}
        </p>
      </div>
      <p className="mt-1 max-w-[62ch] text-[15px] leading-relaxed text-pretty text-ink-soft">{t("requests.intro")}</p>

      <div role="status" aria-live="polite" className="empty:hidden mt-4">
        {notice && (
          <p
            data-testid="requests-notice"
            data-tone={notice.tone}
            className={`rounded-inner px-4 py-3 text-[15px] leading-relaxed ${
              notice.tone === "ok" ? "bg-accent-50 text-ink" : "border border-sand-200 bg-cream-50 font-medium text-ink"
            }`}
          >
            {notice.text}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <p data-testid="requests-empty" className="mt-5 rounded-inner bg-cream-100/70 px-4 py-5 text-[15px] text-ink-soft">
          {t("requests.empty")}
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map((r) => (
            <RequestRow
              key={r.id}
              r={r}
              now={now}
              expired={expired.has(r.id)}
              answering={answering[r.id]}
              onAnswer={(d) => answer(r, d)}
            />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label={t("requests.pager")} className="mt-5 flex items-center justify-between gap-3">
          <PageLink page={page - 1} disabled={page <= 1} label={t("requests.prev")} icon="prev" />
          <span className="text-sm text-ink-soft tabular-nums">{t("requests.page", { page, pages })}</span>
          <PageLink page={page + 1} disabled={page >= pages} label={t("requests.next")} icon="next" />
        </nav>
      )}
    </section>
  );
}

function PageLink({ page, disabled, label, icon }: { page: number; disabled: boolean; label: string; icon: "prev" | "next" }) {
  const Icon = icon === "prev" ? ChevronLeft : ChevronRight;
  const cls = `${pill} size-11 justify-center`;
  if (disabled) {
    return (
      <span aria-hidden className={`${cls} pointer-events-none opacity-40`}>
        <Icon className="size-4" />
      </span>
    );
  }
  return (
    <Link href={page <= 1 ? "/dashboard/rezervari" : `/dashboard/rezervari?pagina=${page}`} aria-label={label} title={label} className={cls}>
      <Icon className="size-4" aria-hidden />
    </Link>
  );
}

function RequestRow({
  r,
  now,
  expired: markedExpired,
  answering,
  onAnswer,
}: {
  r: PendingRequest;
  now: number | null;
  expired: boolean;
  answering: Decision | undefined;
  onAnswer: (d: Decision) => void;
}) {
  const t = useTranslations("Dashboard");
  const left = now === null ? undefined : timeLeft(r.holdExpiresAt, now);
  const expired = markedExpired || left === null;
  const busy = answering !== undefined;
  const until = t("requests.expiresAt", { moment: fmt.moment(r.holdExpiresAt) });

  return (
    <li
      data-testid="request-row"
      data-booking-id={r.id}
      data-state={expired ? "expired" : busy ? answering : "pending"}
      aria-busy={busy || undefined}
      className={`rounded-inner border border-sand/80 bg-cream-50/80 p-4 transition-opacity duration-200 sm:p-5 ${busy ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p data-testid="request-guest" className="text-lg font-semibold break-words text-ink">
            {r.guestName}
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {r.propertyName} · {r.unitName}
          </p>
        </div>
        <span
          data-testid="request-status"
          className={`inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-semibold ${
            expired ? "bg-sand-200 text-ink" : "border border-dashed border-accent/60 bg-cream-50 text-ink"
          }`}
        >
          {expired ? t("requests.expired") : t("requests.pending")}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[15px] sm:grid-cols-4">
        <Item label={t("details.checkIn")} value={fmt.long(r.checkIn)} />
        <Item label={t("details.checkOut")} value={fmt.long(r.checkOut)} />
        <Item
          label={t("details.guests")}
          value={`${t("details.adults", { count: r.adults })}, ${t("details.children", { count: r.children })}`}
        />
        <Item
          label={t("details.total")}
          value={`${formatMoney(r.totalAmount, r.currency, t("kpi.currency"))} · ${t("chart.nights", { count: diffDays(r.checkIn, r.checkOut) })}`}
        />
      </dl>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <a
          href={`tel:${r.guestPhone.replace(/[^\d+]/g, "")}`}
          aria-label={t("requests.call", { phone: r.guestPhone })}
          className="inline-flex min-h-11 items-center gap-2 rounded-inner text-lg font-semibold text-ink tabular-nums underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Phone className="size-4 text-accent" aria-hidden />
          {r.guestPhone}
        </a>
        <a
          href={`mailto:${r.guestEmail}`}
          aria-label={t("requests.write", { email: r.guestEmail })}
          className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-inner text-[15px] break-all text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Mail className="size-4 shrink-0 text-accent" aria-hidden />
          {r.guestEmail}
        </a>
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t border-sand/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft">
          <time dateTime={r.holdExpiresAt} title={until} data-testid="request-expiry">
            {left ? (left.hours > 0 ? t("requests.expiresInHours", left) : t("requests.expiresInMinutes", left)) : until}
          </time>
          <span className="mx-1.5" aria-hidden>
            ·
          </span>
          {t("requests.received", { moment: fmt.moment(r.createdAt) })}
        </p>
        {!expired && (
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              data-testid="request-decline"
              disabled={busy}
              onClick={() => onAnswer("decline")}
              className={`${pill} h-11 justify-center px-5 disabled:pointer-events-none disabled:opacity-60`}
            >
              <X className="size-4" aria-hidden />
              {answering === "decline" ? t("requests.declining") : t("requests.decline")}
            </button>
            <button
              type="button"
              data-testid="request-confirm"
              disabled={busy}
              onClick={() => onAnswer("confirm")}
              className={`${primaryButton} h-11 px-5 py-0 text-[15px] disabled:pointer-events-none disabled:opacity-60`}
            >
              <Check className="size-4" aria-hidden />
              {answering === "confirm" ? t("requests.confirming") : t("requests.confirm")}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</dt>
      <dd className="mt-0.5 text-ink first-letter:uppercase">{value}</dd>
    </div>
  );
}
