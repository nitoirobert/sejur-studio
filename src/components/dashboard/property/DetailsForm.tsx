"use client";

import dynamic from "next/dynamic";
import { useCallback, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, MapPinOff, Wand2 } from "lucide-react";
import { updateProperty } from "@/app/dashboard/proprietati/actions";
import { useSave } from "./client";
import type { PropertyDetails } from "./data";
import { AMENITIES, LIMITS, type Amenity } from "./schema";
import { SLUG_MAX, slugify } from "./slug";
import { AmenityPicker, Field, FormMessage, SubmitButton, described, ghost, input, panel, sectionHeading, textarea } from "./ui";

// MapLibre is browser-only and heavy: loaded after the form, never on the server.
const MapPicker = dynamic(() => import("./MapPicker"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-cream-100/60" />,
});

type Values = {
  name: string;
  slug: string;
  description: string;
  address: string;
  city: string;
  lat: string;
  lng: string;
  check_in_time: string;
  check_out_time: string;
  checkin_instructions: string;
  amenities: Amenity[];
  status: "activa" | "ascunsa";
};

const fromProperty = (p: PropertyDetails): Values => ({
  name: p.name,
  slug: p.slug,
  description: p.description ?? "",
  address: p.address ?? "",
  city: p.city ?? "",
  lat: p.lat === null ? "" : String(p.lat),
  lng: p.lng === null ? "" : String(p.lng),
  check_in_time: p.checkInTime,
  check_out_time: p.checkOutTime,
  checkin_instructions: p.checkinInstructions ?? "",
  amenities: p.amenities,
  status: p.status,
});

/** A typed coordinate for the map: null when empty, not a number or out of range (|lat| <= 90, |lng| <= 180). */
const coord = (v: string, limit: number): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
};
/** Typed but not usable: the field shows its Romanian message before the save. */
const badCoord = (v: string, limit: number) => v.trim() !== "" && coord(v, limit) === null;

export function DetailsForm({ property }: { property: PropertyDetails }) {
  const t = useTranslations("Dashboard.properties");
  const id = useId();
  const f = (name: string) => `${id}-${name}`;
  const { pending, failure, run, fieldError, formError, clear } = useSave();
  const [values, setValues] = useState<Values>(() => fromProperty(property));
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: value }));
  };
  const onText =
    (key: Exclude<keyof Values, "amenities" | "status">) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key, e.target.value);

  const onPin = useCallback((lat: number, lng: number) => {
    setSaved(false);
    setValues((v) => ({ ...v, lat: String(lat), lng: String(lng) }));
  }, []);

  const suggestion = failure?.code === "slug_taken" ? failure.suggestion : undefined;
  const slugError = suggestion ? t("formErrors.slug_taken") : fieldError("slug");
  const latError = fieldError("lat") ?? (badCoord(values.lat, 90) ? t("fieldErrors.lat") : null);
  const lngError = fieldError("lng") ?? (badCoord(values.lng, 180) ? t("fieldErrors.lng") : null);

  const amenityOptions = AMENITIES.map((key) => ({ key, label: t(`amenities.${key}`) }));

  return (
    <form
      data-testid="property-details-form"
      noValidate
      className="flex flex-col gap-4 md:gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        run(
          () => updateProperty({ id: property.id, ...values }),
          () => setSaved(true),
        );
      }}
    >
      <div className="grid gap-4 md:gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className={`${panel} flex flex-col gap-5 p-5 sm:p-7`} aria-labelledby={f("general")}>
          <h3 id={f("general")} className={sectionHeading}>
            {t("details.general")}
          </h3>
          <Field id={f("name")} label={t("details.name")} error={fieldError("name")}>
            <input
              id={f("name")}
              data-testid="details-name"
              className={input}
              value={values.name}
              maxLength={LIMITS.propertyName}
              autoComplete="off"
              onChange={onText("name")}
              {...described(f("name"), fieldError("name"))}
            />
          </Field>
          <Field id={f("slug")} label={t("details.slug")} hint={t("details.slugHint")} error={slugError}>
            <div className="flex gap-2">
              <input
                id={f("slug")}
                data-testid="details-slug"
                className={`${input} font-mono text-[15px]`}
                value={values.slug}
                maxLength={SLUG_MAX}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => {
                  clear();
                  set("slug", e.target.value.toLowerCase());
                }}
                {...described(f("slug"), slugError, true)}
              />
              <button
                type="button"
                data-testid="details-slug-from-name"
                onClick={() => set("slug", slugify(values.name))}
                className={`${ghost} shrink-0 border border-glass-line bg-cream-50/60`}
              >
                <Wand2 className="size-4" aria-hidden />
                <span className="hidden sm:inline">{t("details.slugFromName")}</span>
                <span className="sr-only sm:hidden">{t("details.slugFromName")}</span>
              </button>
            </div>
            {suggestion && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink">
                <span>{t("details.slugSuggestion", { slug: suggestion })}</span>
                <button
                  type="button"
                  data-testid="details-slug-use-suggestion"
                  onClick={() => {
                    clear();
                    set("slug", suggestion);
                  }}
                  className="rounded-full bg-accent-50 px-3 py-1 font-semibold text-accent hover:bg-accent/15 focus-visible:outline-2 focus-visible:outline-accent dark:bg-accent/15"
                >
                  {t("details.useSuggestion")}
                </button>
              </p>
            )}
          </Field>
          <Field id={f("description")} label={t("details.description")} optional={t("details.optional")} error={fieldError("description")}>
            <textarea
              id={f("description")}
              data-testid="details-description"
              className={`${textarea} min-h-36`}
              value={values.description}
              maxLength={LIMITS.description}
              onChange={onText("description")}
              {...described(f("description"), fieldError("description"))}
            />
          </Field>
          <fieldset data-testid="details-status">
            <legend className="mb-1.5 text-sm font-semibold text-ink">{t("details.status")}</legend>
            <div className="inline-flex rounded-full border border-glass-line bg-cream-50/60 p-1">
              {(["activa", "ascunsa"] as const).map((s) => (
                <label
                  key={s}
                  className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                    values.status === s ? "bg-accent text-cream-50 dark:bg-accent-strong dark:text-[#0d1626]" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name={f("status")}
                    value={s}
                    data-testid={`details-status-${s}`}
                    className="sr-only"
                    checked={values.status === s}
                    onChange={() => set("status", s)}
                  />
                  {values.status === s && <Check className="size-3.5" aria-hidden />}
                  {t(`status.${s}`)}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-[13px] text-ink-soft">{t("details.statusHint")}</p>
          </fieldset>
        </section>

        <section className={`${panel} flex flex-col gap-5 p-5 sm:p-7`} aria-labelledby={f("location")}>
          <h3 id={f("location")} className={sectionHeading}>
            {t("details.location")}
          </h3>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id={f("address")} label={t("details.address")} optional={t("details.optional")} error={fieldError("address")}>
              <input
                id={f("address")}
                data-testid="details-address"
                className={input}
                value={values.address}
                maxLength={LIMITS.address}
                autoComplete="street-address"
                onChange={onText("address")}
                {...described(f("address"), fieldError("address"))}
              />
            </Field>
            <Field id={f("city")} label={t("details.city")} optional={t("details.optional")} error={fieldError("city")}>
              <input
                id={f("city")}
                data-testid="details-city"
                className={input}
                value={values.city}
                maxLength={LIMITS.city}
                autoComplete="address-level2"
                onChange={onText("city")}
                {...described(f("city"), fieldError("city"))}
              />
            </Field>
          </div>
          <div>
            <div className="relative h-64 overflow-hidden rounded-inner border border-glass-line bg-cream-100/60 sm:h-72">
              <MapPicker lat={coord(values.lat, 90)} lng={coord(values.lng, 180)} label={t("details.mapLabel")} onChange={onPin} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-ink-soft">{t("details.mapHint")}</p>
              {(values.lat || values.lng) && (
                <button
                  type="button"
                  data-testid="details-map-clear"
                  onClick={() => {
                    set("lat", "");
                    set("lng", "");
                  }}
                  className={`${ghost} min-h-9 px-3 text-[13px]`}
                >
                  <MapPinOff className="size-3.5" aria-hidden />
                  {t("details.mapClear")}
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field id={f("lat")} label={t("details.lat")} error={latError}>
              <input
                id={f("lat")}
                data-testid="details-lat"
                className={`${input} tabular-nums`}
                inputMode="decimal"
                value={values.lat}
                maxLength={24}
                autoComplete="off"
                onChange={onText("lat")}
                {...described(f("lat"), latError)}
              />
            </Field>
            <Field id={f("lng")} label={t("details.lng")} error={lngError}>
              <input
                id={f("lng")}
                data-testid="details-lng"
                className={`${input} tabular-nums`}
                inputMode="decimal"
                value={values.lng}
                maxLength={24}
                autoComplete="off"
                onChange={onText("lng")}
                {...described(f("lng"), lngError)}
              />
            </Field>
          </div>
        </section>
      </div>

      <div className="grid gap-4 md:gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className={`${panel} flex flex-col gap-5 p-5 sm:p-7`} aria-labelledby={f("stay")}>
          <h3 id={f("stay")} className={sectionHeading}>
            {t("details.stay")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Field id={f("in")} label={t("details.checkIn")} error={fieldError("check_in_time")}>
              <input
                id={f("in")}
                data-testid="details-check-in"
                type="time"
                step={900}
                className={`${input} tabular-nums`}
                value={values.check_in_time}
                onChange={onText("check_in_time")}
                {...described(f("in"), fieldError("check_in_time"))}
              />
            </Field>
            <Field id={f("out")} label={t("details.checkOut")} error={fieldError("check_out_time")}>
              <input
                id={f("out")}
                data-testid="details-check-out"
                type="time"
                step={900}
                className={`${input} tabular-nums`}
                value={values.check_out_time}
                onChange={onText("check_out_time")}
                {...described(f("out"), fieldError("check_out_time"))}
              />
            </Field>
          </div>
          <Field
            id={f("instructions")}
            label={t("details.instructions")}
            optional={t("details.optional")}
            hint={t("details.instructionsHint")}
            error={fieldError("checkin_instructions")}
          >
            <textarea
              id={f("instructions")}
              data-testid="details-instructions"
              className={textarea}
              value={values.checkin_instructions}
              maxLength={LIMITS.instructions}
              onChange={onText("checkin_instructions")}
              {...described(f("instructions"), fieldError("checkin_instructions"), true)}
            />
          </Field>
        </section>

        <section className={`${panel} p-5 sm:p-7`}>
          <AmenityPicker
            idPrefix="details"
            legend={t("details.amenities")}
            options={amenityOptions}
            value={values.amenities}
            onChange={(next) => set("amenities", next as Amenity[])}
            error={fieldError("amenities")}
          />
        </section>
      </div>

      {/* The save bar stays in reach while the long form scrolls. */}
      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-card border border-glass-line bg-glass-strong p-3 shadow-glass backdrop-blur-xl sm:flex-row sm:items-center sm:justify-end">
        <div aria-live="polite" className="min-w-0 sm:mr-auto">
          {formError && !suggestion && (
            <FormMessage testId="details-error" tone="error">
              {formError}
            </FormMessage>
          )}
          {saved && !pending && (
            <p role="status" data-testid="details-saved" className="flex items-center gap-2 px-2 text-sm font-semibold text-accent">
              <Check className="size-4" aria-hidden />
              {t("details.saved")}
            </p>
          )}
        </div>
        <SubmitButton pending={pending} label={t("details.submit")} pendingLabel={t("details.pending")} testId="details-submit" className="px-6" />
      </div>
    </form>
  );
}
