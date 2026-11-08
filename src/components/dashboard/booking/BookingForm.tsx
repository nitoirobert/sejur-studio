"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LoaderCircle } from "lucide-react";
import { primaryButton } from "@/components/ui/soft";
import { diffDays, isIsoDate, type IsoDate } from "@/lib/dates/days";
import type { ChartBooking, ChartProperty } from "../chart/types";
import { useOverview } from "./OverviewProvider";
import {
  ADULTS_MAX,
  CHILDREN_MAX,
  EMAIL_MAX,
  NAME_MAX,
  PHONE_MAX,
  manualBookingSchema,
  parseLei,
  schemaErrorCode,
  type BookingErrorCode,
  type ManualBookingInput,
} from "./schema";

export type Draft = { unitId: string; checkIn: IsoDate; checkOut: IsoDate };

const input =
  "h-12 w-full rounded-inner border border-glass-line bg-cream-100/85 px-4 text-base text-ink shadow-pressed outline-none transition-[box-shadow,border-color] duration-150 placeholder:text-ink-soft/80 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/20";

const FIELDS_BY_CODE: Partial<Record<BookingErrorCode, string[]>> = {
  invalid_dates: ["check_in", "check_out"],
  invalid_guest: ["full_name", "email", "phone", "adults", "children"],
  invalid_amount: ["amount"],
  unit_not_found: ["unit_id"],
  booking_overlap: ["check_in", "check_out"],
};

/*
  The short manual-booking form. Mounted fresh for each selection (keyed by the parent) and kept
  mounted while saving, so an error leaves every typed value in place.
*/
export function BookingForm({
  draft,
  properties,
  onSaved,
  onCancel,
}: {
  draft: Draft;
  properties: ChartProperty[];
  onSaved: (guest: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Dashboard.booking");
  const id = useId();
  const { create } = useOverview();
  const [values, setValues] = useState({
    unit_id: draft.unitId,
    check_in: draft.checkIn,
    check_out: draft.checkOut,
    full_name: "",
    email: "",
    phone: "",
    adults: "2",
    children: "0",
    amount: "",
  });
  const [error, setError] = useState<BookingErrorCode | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false); // a double click submits once

  const set = (name: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [name]: e.target.value }));

  const nights =
    isIsoDate(values.check_in) && isIsoDate(values.check_out) ? diffDays(values.check_in, values.check_out) : 0;
  const bad = new Set(error ? (FIELDS_BY_CODE[error] ?? []) : []);
  const invalid = (name: string) => (bad.has(name) ? true : undefined);
  const describedBy = (name: string, extra?: string) =>
    [bad.has(name) ? `${id}-error` : null, extra].filter(Boolean).join(" ") || undefined;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    const payload: ManualBookingInput = {
      unit_id: values.unit_id,
      check_in: values.check_in,
      check_out: values.check_out,
      full_name: values.full_name,
      email: values.email,
      phone: values.phone,
      adults: values.adults,
      children: values.children,
      amount: values.amount,
    };
    // Same rules as the server, so a typo never flashes an optimistic bar. The server checks again.
    const local = manualBookingSchema.safeParse(payload);
    if (!local.success) {
      setError(schemaErrorCode(local.error));
      return;
    }
    const unit = properties.flatMap((p) => p.units).find((u) => u.id === values.unit_id);
    const preview: ChartBooking = {
      id: `pending-${Date.now()}`,
      unitId: values.unit_id,
      propertyId: unit?.propertyId ?? "",
      checkIn: values.check_in,
      checkOut: values.check_out,
      status: "confirmed",
      source: "direct",
      guestName: local.data.full_name,
      adults: local.data.adults,
      children: local.data.children,
      totalAmount: parseLei(values.amount) ?? 0,
      currency: "RON",
      holdExpiresAt: null,
    };

    busy.current = true;
    setSaving(true);
    setError(null);
    const result = await create(payload, preview);
    busy.current = false;
    setSaving(false);
    if (result.ok) onSaved(local.data.full_name);
    else setError(result.code);
  }

  return (
    <form onSubmit={submit} noValidate data-testid="booking-form" aria-busy={saving} className="space-y-4 pt-1">
      <Field id={`${id}-unit`} label={t("unit")}>
        <select
          id={`${id}-unit`}
          name="unit_id"
          data-testid="booking-unit"
          value={values.unit_id}
          onChange={set("unit_id")}
          aria-invalid={invalid("unit_id")}
          aria-describedby={describedBy("unit_id")}
          className={`${input} appearance-none bg-[length:0]`}
        >
          {properties.map((p) => (
            <optgroup key={p.id} label={p.name}>
              {p.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id={`${id}-in`} label={t("checkIn")}>
          <input
            id={`${id}-in`}
            name="check_in"
            type="date"
            data-testid="booking-check-in"
            required
            value={values.check_in}
            onChange={set("check_in")}
            aria-invalid={invalid("check_in")}
            aria-describedby={describedBy("check_in", `${id}-nights`)}
            className={`${input} px-3`}
          />
        </Field>
        <Field id={`${id}-out`} label={t("checkOut")}>
          <input
            id={`${id}-out`}
            name="check_out"
            type="date"
            data-testid="booking-check-out"
            required
            value={values.check_out}
            onChange={set("check_out")}
            aria-invalid={invalid("check_out")}
            aria-describedby={describedBy("check_out", `${id}-nights`)}
            className={`${input} px-3`}
          />
        </Field>
      </div>
      <NightsNote id={`${id}-nights`} nights={nights} />

      <Field id={`${id}-name`} label={t("name")}>
        <input
          id={`${id}-name`}
          name="full_name"
          data-testid="booking-name"
          data-autofocus
          type="text"
          autoComplete="off"
          maxLength={NAME_MAX}
          required
          placeholder={t("namePlaceholder")}
          value={values.full_name}
          onChange={set("full_name")}
          aria-invalid={invalid("full_name")}
          aria-describedby={describedBy("full_name")}
          className={input}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${id}-email`} label={t("email")} optional={t("optional")}>
          <input
            id={`${id}-email`}
            name="email"
            data-testid="booking-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={EMAIL_MAX}
            value={values.email}
            onChange={set("email")}
            aria-invalid={invalid("email")}
            aria-describedby={describedBy("email")}
            className={input}
          />
        </Field>
        <Field id={`${id}-phone`} label={t("phone")} optional={t("optional")}>
          <input
            id={`${id}-phone`}
            name="phone"
            data-testid="booking-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            maxLength={PHONE_MAX}
            value={values.phone}
            onChange={set("phone")}
            aria-invalid={invalid("phone")}
            aria-describedby={describedBy("phone")}
            className={input}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field id={`${id}-adults`} label={t("adults")}>
          <input
            id={`${id}-adults`}
            name="adults"
            data-testid="booking-adults"
            type="number"
            inputMode="numeric"
            min={1}
            max={ADULTS_MAX}
            step={1}
            required
            value={values.adults}
            onChange={set("adults")}
            aria-invalid={invalid("adults")}
            aria-describedby={describedBy("adults")}
            className={input}
          />
        </Field>
        <Field id={`${id}-children`} label={t("children")}>
          <input
            id={`${id}-children`}
            name="children"
            data-testid="booking-children"
            type="number"
            inputMode="numeric"
            min={0}
            max={CHILDREN_MAX}
            step={1}
            required
            value={values.children}
            onChange={set("children")}
            aria-invalid={invalid("children")}
            aria-describedby={describedBy("children")}
            className={input}
          />
        </Field>
      </div>

      <Field id={`${id}-amount`} label={t("amount")}>
        <div className="relative">
          <input
            id={`${id}-amount`}
            name="amount"
            data-testid="booking-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            maxLength={16}
            value={values.amount}
            onChange={set("amount")}
            aria-invalid={invalid("amount")}
            aria-describedby={describedBy("amount", `${id}-amount-hint`)}
            className={`${input} pr-12 tabular-nums`}
          />
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-ink-soft">
            lei
          </span>
        </div>
        <p id={`${id}-amount-hint`} className="mt-1.5 text-[13px] text-ink-soft">
          {t("amountHint")}
        </p>
      </Field>

      <div aria-live="polite">
        {error && (
          <p
            id={`${id}-error`}
            role="alert"
            data-testid="booking-error"
            data-code={error}
            className="rounded-inner bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
          >
            {t(`errors.${error}`)}
          </p>
        )}
      </div>

      {/* Phone: the actions stay pinned to the bottom of the sheet while the fields scroll. */}
      <div className="sticky bottom-0 z-10 -mx-5 flex flex-col-reverse gap-2 border-t border-glass-line bg-glass-strong px-5 pt-3 pb-1 backdrop-blur-xl sm:flex-row md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pt-1 md:backdrop-blur-none">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="min-h-12 disabled:opacity-50 rounded-full px-5 text-[15px] font-medium text-ink-soft transition-colors hover:bg-cream-50/70 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          data-testid="booking-submit"
          disabled={saving}
          className={`${primaryButton} min-h-12 flex-1 disabled:opacity-80 dark:bg-accent-strong dark:font-bold dark:text-[#0d1626] dark:hover:bg-accent`}
        >
          {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {saving ? t("pending") : t("submit")}
        </button>
      </div>
    </form>
  );
}

function NightsNote({ id, nights }: { id: string; nights: number }) {
  const t = useTranslations("Dashboard.chart");
  return (
    <p id={id} data-testid="booking-nights" className="-mt-2 text-[13px] text-ink-soft">
      {nights > 0 ? t("nights", { count: nights }) : "\u00a0"}
    </p>
  );
}

function Field({
  id,
  label,
  optional,
  children,
}: {
  id: string;
  label: string;
  optional?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-soft">({optional})</span>}
      </label>
      {children}
    </div>
  );
}
