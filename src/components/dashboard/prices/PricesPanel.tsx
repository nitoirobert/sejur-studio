"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarRange, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteSeason, deleteWeekendPrice, saveBasePrice, saveSeason, saveWeekendPrice } from "@/app/dashboard/proprietati/actions";
import { Sheet } from "@/components/dashboard/booking/Sheet";
import { fmt } from "@/components/dashboard/chart/format";
import { baniToInput, lei, useSave } from "@/components/dashboard/property/client";
import type { ActionResult } from "@/components/dashboard/property/schema";
import { Field, FormMessage, SubmitButton, actionBar, danger, described, ghost, input, panel, primary, sectionHeading } from "@/components/dashboard/property/ui";
import { diffDays, weekday, type IsoDate } from "@/lib/dates/days";
import { MIN_NIGHTS_MAX, PRIORITY_MAX, dateToToLastNight, previewNights, type NightPrice, type PriceKind, type PriceRule } from "./rules";

type UnitOption = { id: string; name: string };
type Notice = { tone: "ok" | "error"; text: string };

const KIND_CELL: Record<PriceKind, string> = {
  base: "border-glass-line bg-cream-50/70 text-ink",
  weekend: "border-sand bg-sand-200 text-ink dark:border-sand/40 dark:bg-sand/25",
  season: "border-accent/40 bg-accent-50 text-accent dark:bg-accent/15",
};
const KIND_DOT: Record<PriceKind, string> = {
  base: "bg-cream-100 ring-1 ring-glass-line",
  weekend: "bg-sand",
  season: "bg-accent",
};

const amount = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });

/*
  Prețuri of one unit: base, one weekend rule (Friday and Saturday nights), seasons, and what the
  next 30 nights cost under them (season > weekend > base, the same rule as the booking page).
*/
export function PricesPanel({
  propertyId,
  units,
  unitId,
  rules,
  today,
}: {
  propertyId: string;
  units: UnitOption[];
  unitId: string | null;
  rules: PriceRule[];
  today: IsoDate;
}) {
  const t = useTranslations("Dashboard.properties.prices");
  const tAll = useTranslations("Dashboard.properties");
  const [notice, setNotice] = useState<Notice | null>(null);

  if (!unitId) {
    return (
      <section data-testid="prices-no-units" className={`${panel} flex flex-col items-start gap-4 p-6 sm:p-8`}>
        <p className="max-w-[52ch] text-[15px] text-ink">{t("noUnits")}</p>
        <Link href={`/dashboard/proprietati/${propertyId}?tab=unitati`} className={`${primary} px-5`}>
          {t("goUnits")}
        </Link>
      </section>
    );
  }

  const base = rules.find((r) => r.kind === "base") ?? null;
  const weekend = rules.find((r) => r.kind === "weekend") ?? null;
  const seasons = rules
    .filter((r) => r.kind === "season")
    .sort((a, b) => (a.dateFrom ?? "").localeCompare(b.dateFrom ?? "") || b.priority - a.priority);
  const report = (r: ActionResult, ok: string) => setNotice(r.ok ? { tone: "ok", text: ok } : { tone: "error", text: tAll(`formErrors.${r.code}`) });

  return (
    <div data-testid="prices-panel" data-unit-id={unitId} className="flex flex-col gap-4 md:gap-5">
      {units.length > 1 && (
        <nav aria-label={t("unit")} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          <ul className="inline-flex min-w-max gap-2">
            {units.map((u) => {
              const on = u.id === unitId;
              return (
                <li key={u.id}>
                  <Link
                    href={`/dashboard/proprietati/${propertyId}?tab=preturi&unitate=${u.id}`}
                    scroll={false}
                    aria-current={on ? "true" : undefined}
                    data-testid="prices-unit"
                    data-unit-id={u.id}
                    onClick={() => setNotice(null)}
                    className={`inline-flex h-10 items-center rounded-full border px-4 text-[14px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      on
                        ? "border-accent bg-accent text-cream-50 dark:border-accent-strong dark:bg-accent-strong dark:text-[#0d1626]"
                        : "border-glass-line bg-glass text-ink-soft hover:text-ink"
                    }`}
                  >
                    {u.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <div aria-live="polite">
        {notice && (
          <FormMessage testId={notice.tone === "error" ? "prices-error" : "prices-notice"} tone={notice.tone}>
            {notice.text}
          </FormMessage>
        )}
      </div>

      <div className="grid gap-4 md:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4 md:gap-5">
          <section className={`${panel} p-5 sm:p-7`} aria-labelledby="price-base-title" data-testid="price-base">
            <h3 id="price-base-title" className={sectionHeading}>
              {t("base.title")}
            </h3>
            <p className="mt-1 mb-4 text-[13px] text-ink-soft">{t("base.hint")}</p>
            <PriceForm
              key={`base-${unitId}-${base?.price}-${base?.minNights}`}
              testPrefix="price-base"
              rule={base}
              submit={(v) => saveBasePrice({ unit_id: unitId, ...v })}
              onDone={(r) => report(r, t("saved"))}
            />
          </section>

          <section className={`${panel} p-5 sm:p-7`} aria-labelledby="price-weekend-title" data-testid="price-weekend">
            <h3 id="price-weekend-title" className={sectionHeading}>
              {t("weekend.title")}
            </h3>
            <p className="mt-1 mb-4 text-[13px] text-ink-soft">{t("weekend.hint")}</p>
            <WeekendBlock
              key={`weekend-${unitId}-${weekend?.id}-${weekend?.price}-${weekend?.minNights}`}
              unitId={unitId}
              rule={weekend}
              onDone={report}
            />
          </section>

          <SeasonsBlock key={`seasons-${unitId}`} unitId={unitId} seasons={seasons} onDone={report} />
        </div>

        <Preview rules={rules} today={today} />
      </div>
    </div>
  );
}

type PriceValues = { price: string; min_nights: string };

function PriceForm({
  testPrefix,
  rule,
  submit,
  onDone,
  extra,
}: {
  testPrefix: string;
  rule: PriceRule | null;
  submit: (v: PriceValues) => Promise<ActionResult>;
  onDone: (r: ActionResult) => void;
  extra?: React.ReactNode;
}) {
  const t = useTranslations("Dashboard.properties.prices");
  const id = useId();
  const { pending, run, fieldError, formError } = useSave();
  const [v, setV] = useState<PriceValues>({ price: baniToInput(rule?.price), min_nights: String(rule?.minNights ?? 1) });

  return (
    <form
      noValidate
      data-testid={`${testPrefix}-form`}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => submit(v),
          () => onDone({ ok: true }),
        );
      }}
    >
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
        <PriceInput id={`${id}-price`} testId={`${testPrefix}-price`} label={t("perNight")} value={v.price} error={fieldError("price")} onChange={(price) => setV((s) => ({ ...s, price }))} />
        <Field id={`${id}-min`} label={t("minNights")} error={fieldError("min_nights")}>
          <input
            id={`${id}-min`}
            data-testid={`${testPrefix}-min`}
            className={`${input} tabular-nums`}
            inputMode="numeric"
            maxLength={3}
            value={v.min_nights}
            onChange={(e) => setV((s) => ({ ...s, min_nights: e.target.value.replace(/\D/g, "") }))}
            {...described(`${id}-min`, fieldError("min_nights"))}
          />
        </Field>
      </div>
      {formError && (
        <FormMessage testId={`${testPrefix}-error`} tone="error">
          {formError}
        </FormMessage>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {extra}
        <SubmitButton pending={pending} label={t("save")} pendingLabel={t("pending")} testId={`${testPrefix}-save`} className="px-6" />
      </div>
    </form>
  );
}

function PriceInput({
  id,
  testId,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  testId: string;
  label: string;
  value: string;
  error: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <Field id={id} label={label} error={error}>
      <div className="relative">
        <input
          id={id}
          data-testid={testId}
          className={`${input} pr-12 tabular-nums`}
          inputMode="decimal"
          maxLength={16}
          placeholder="350"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...described(id, error)}
        />
        <span aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-ink-soft">
          lei
        </span>
      </div>
    </Field>
  );
}

function WeekendBlock({ unitId, rule, onDone }: { unitId: string; rule: PriceRule | null; onDone: (r: ActionResult, ok: string) => void }) {
  const t = useTranslations("Dashboard.properties.prices");
  const [adding, setAdding] = useState(false);
  const del = useSave();

  if (!rule && !adding) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p data-testid="price-weekend-none" className="text-[14px] text-ink-soft">
          {t("weekend.none")}
        </p>
        <button type="button" data-testid="price-weekend-add" onClick={() => setAdding(true)} className={`${ghost} border border-glass-line bg-cream-50/60`}>
          <Plus className="size-4" aria-hidden />
          {t("weekend.add")}
        </button>
      </div>
    );
  }

  return (
    <>
      <PriceForm
        testPrefix="price-weekend"
        rule={rule}
        submit={(v) => saveWeekendPrice({ unit_id: unitId, ...v })}
        onDone={(r) => onDone(r, t("saved"))}
        extra={
          rule ? (
            <button
              type="button"
              data-testid="price-weekend-delete"
              disabled={del.pending}
              onClick={() =>
                del.run(
                  () => deleteWeekendPrice({ unit_id: unitId }),
                  () => onDone({ ok: true }, t("weekend.deleted")),
                )
              }
              className={`${ghost} hover:text-danger sm:mr-auto`}
            >
              <Trash2 className="size-4" aria-hidden />
              {t("weekend.delete")}
            </button>
          ) : (
            <button type="button" onClick={() => setAdding(false)} className={ghost}>
              {t("cancel")}
            </button>
          )
        }
      />
      {del.formError && (
        <p role="alert" className="mt-2 text-[13px] font-medium text-danger">
          {del.formError}
        </p>
      )}
    </>
  );
}

function SeasonsBlock({ unitId, seasons, onDone }: { unitId: string; seasons: PriceRule[]; onDone: (r: ActionResult, ok: string) => void }) {
  const t = useTranslations("Dashboard.properties.prices");
  const [editing, setEditing] = useState<PriceRule | "new" | null>(null);
  const [formKey, setFormKey] = useState(0);
  const open = (s: PriceRule | "new") => {
    setFormKey((k) => k + 1);
    setEditing(s);
  };

  return (
    <section className={`${panel} p-5 sm:p-7`} aria-labelledby="price-seasons-title" data-testid="price-seasons">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <h3 id="price-seasons-title" className={sectionHeading}>
            {t("seasons.title")}
          </h3>
          <p className="mt-1 text-[13px] text-ink-soft">{t("seasons.hint")}</p>
        </div>
        <button type="button" data-testid="season-add" onClick={() => open("new")} className={`${primary} px-5`}>
          <Plus className="size-4" aria-hidden />
          {t("seasons.add")}
        </button>
      </div>
      {seasons.length === 0 ? (
        <p data-testid="season-empty" className="mt-4 text-[14px] text-ink-soft">
          {t("seasons.empty")}
        </p>
      ) : (
        <ul data-testid="season-list" className="mt-4 flex flex-col gap-2">
          {seasons.map((s) => (
            <SeasonItem key={s.id} season={s} onEdit={() => open(s)} onDone={onDone} />
          ))}
        </ul>
      )}
      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("seasons.titleNew") : t("seasons.titleEdit")}
        closeLabel={t("close")}
        testId="season-sheet"
      >
        {editing !== null && (
          <SeasonForm
            key={formKey}
            unitId={unitId}
            season={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              onDone({ ok: true }, t("saved"));
            }}
          />
        )}
      </Sheet>
    </section>
  );
}

function seasonRange(s: PriceRule) {
  const from = s.dateFrom ?? "";
  const last = s.dateTo ? dateToToLastNight(s.dateTo) : from;
  return { from, last, nights: s.dateFrom && s.dateTo ? diffDays(s.dateFrom, s.dateTo) : 0 };
}

function SeasonItem({ season, onEdit, onDone }: { season: PriceRule; onEdit: () => void; onDone: (r: ActionResult, ok: string) => void }) {
  const t = useTranslations("Dashboard.properties.prices");
  const [confirming, setConfirming] = useState(false);
  const { pending, run, formError } = useSave();
  const { from, last, nights } = seasonRange(season);
  const range = t("seasons.range", { from: fmt.short(from), to: fmt.short(last) });

  return (
    <li data-testid="season-row" data-season-id={season.id} className="flex flex-col gap-3 rounded-inner border border-glass-line bg-cream-50/70 p-3 sm:flex-row sm:items-center sm:p-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-50 text-accent dark:bg-accent/15">
          <CalendarRange className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p data-testid="season-range" className="text-[15px] font-semibold text-ink">
            {range} <span className="font-normal text-ink-soft">· {t("seasons.nights", { count: nights })}</span>
          </p>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            <span data-testid="season-price" className="font-semibold text-ink tabular-nums">
              {lei(season.price)}
            </span>{" "}
            · {t("seasons.meta", { min: season.minNights, priority: season.priority })}
          </p>
        </div>
      </div>
      {confirming ? (
        <div role="group" aria-label={t("seasons.deleteConfirm", { range })} className="flex flex-wrap items-center gap-2">
          <span className="w-full text-[13px] text-ink sm:w-auto">{t("seasons.deleteConfirm", { range })}</span>
          <button
            type="button"
            data-testid="season-delete-confirm"
            disabled={pending}
            onClick={() =>
              run(
                () => deleteSeason({ id: season.id }),
                () => onDone({ ok: true }, t("seasons.deleted")),
              )
            }
            className={danger}
          >
            {t("seasons.deleteYes")}
          </button>
          <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={ghost}>
            {t("seasons.deleteNo")}
          </button>
          {formError && (
            <p role="alert" className="w-full text-[13px] font-medium text-danger">
              {formError}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1 self-end sm:self-auto">
          <button type="button" data-testid="season-edit" onClick={onEdit} aria-label={t("seasons.edit", { range })} title={t("seasons.edit", { range })} className={`${ghost} size-11 px-0`}>
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            data-testid="season-delete"
            onClick={() => setConfirming(true)}
            aria-label={t("seasons.delete", { range })}
            title={t("seasons.delete", { range })}
            className={`${ghost} size-11 px-0 hover:text-danger`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </li>
  );
}

function SeasonForm({ unitId, season, onCancel, onSaved }: { unitId: string; season: PriceRule | null; onCancel: () => void; onSaved: () => void }) {
  const t = useTranslations("Dashboard.properties.prices");
  const id = useId();
  const f = (n: string) => `${id}-${n}`;
  const { pending, run, fieldError, formError } = useSave();
  const range = season ? seasonRange(season) : null;
  const [v, setV] = useState({
    first_night: range?.from ?? "",
    last_night: range?.last ?? "",
    price: baniToInput(season?.price),
    min_nights: String(season?.minNights ?? 1),
    priority: String(season?.priority ?? 0),
  });
  const set = (k: keyof typeof v, value: string) => setV((s) => ({ ...s, [k]: value }));

  return (
    <form
      noValidate
      data-testid="season-form"
      className="flex flex-col gap-5 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => saveSeason({ id: season?.id ?? null, unit_id: unitId, ...v }),
          () => onSaved(),
        );
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field id={f("first")} label={t("seasons.firstNight")} error={fieldError("first_night")}>
          <input
            id={f("first")}
            type="date"
            data-testid="season-first"
            data-autofocus
            className={`${input} px-3 tabular-nums`}
            value={v.first_night}
            onChange={(e) => {
              const first = e.target.value;
              setV((s) => ({ ...s, first_night: first, last_night: s.last_night && s.last_night >= first ? s.last_night : first }));
            }}
            {...described(f("first"), fieldError("first_night"))}
          />
        </Field>
        <Field id={f("last")} label={t("seasons.lastNight")} error={fieldError("last_night")}>
          <input
            id={f("last")}
            type="date"
            data-testid="season-last"
            className={`${input} px-3 tabular-nums`}
            value={v.last_night}
            min={v.first_night || undefined}
            onChange={(e) => set("last_night", e.target.value)}
            {...described(f("last"), fieldError("last_night"), true)}
          />
        </Field>
      </div>
      {!fieldError("last_night") && <p className="-mt-3 text-[13px] text-ink-soft">{t("seasons.lastNightHint")}</p>}
      <PriceInput id={f("price")} testId="season-price-input" label={t("perNight")} value={v.price} error={fieldError("price")} onChange={(p) => set("price", p)} />
      <div className="grid grid-cols-2 gap-3">
        <Field id={f("min")} label={t("minNights")} error={fieldError("min_nights")}>
          <input
            id={f("min")}
            data-testid="season-min"
            className={`${input} tabular-nums`}
            inputMode="numeric"
            maxLength={String(MIN_NIGHTS_MAX).length}
            value={v.min_nights}
            onChange={(e) => set("min_nights", e.target.value.replace(/\D/g, ""))}
            {...described(f("min"), fieldError("min_nights"))}
          />
        </Field>
        <Field id={f("priority")} label={t("seasons.priority")} hint={t("seasons.priorityHint")} error={fieldError("priority")}>
          <input
            id={f("priority")}
            data-testid="season-priority"
            className={`${input} tabular-nums`}
            inputMode="numeric"
            maxLength={String(PRIORITY_MAX).length}
            value={v.priority}
            onChange={(e) => set("priority", e.target.value.replace(/\D/g, ""))}
            {...described(f("priority"), fieldError("priority"), true)}
          />
        </Field>
      </div>
      {formError && (
        <FormMessage testId="season-form-error" tone="error">
          {formError}
        </FormMessage>
      )}
      <div className={actionBar}>
        <button type="button" onClick={onCancel} disabled={pending} className={ghost}>
          {t("cancel")}
        </button>
        <SubmitButton pending={pending} label={t("save")} pendingLabel={t("pending")} testId="season-submit" className="px-6" />
      </div>
    </form>
  );
}

function Preview({ rules, today }: { rules: PriceRule[]; today: IsoDate }) {
  const t = useTranslations("Dashboard.properties.prices.preview");
  const nights = previewNights(rules, today, 30);
  const kindLabel = (k: PriceKind | null) => (k ? t(k) : t("none"));
  const legend: PriceKind[] = ["base", "weekend", "season"];

  return (
    <section className={`${panel} h-fit p-5 sm:p-7 xl:sticky xl:top-4`} aria-labelledby="price-preview-title" data-testid="price-preview">
      <h3 id="price-preview-title" className={sectionHeading}>
        {t("title")}
      </h3>
      <p className="mt-1 text-[13px] text-ink-soft">{t("hint")} · lei</p>
      <ul className="mt-3 mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft" aria-hidden>
        {legend.map((k) => (
          <li key={k} className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${KIND_DOT[k]}`} />
            {t(k)}
          </li>
        ))}
      </ul>
      {/* Seven columns, Monday first: weekends line up, like a calendar. */}
      <ol data-testid="price-preview-nights" className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {Array.from({ length: (weekday(today) + 6) % 7 }, (_, i) => (
          <li key={`pad-${i}`} aria-hidden />
        ))}
        {nights.map((n) => (
          <NightCell key={n.night} n={n} label={t("night", { date: fmt.long(n.night), price: n.price === null ? t("none") : lei(n.price), kind: kindLabel(n.kind) })} />
        ))}
      </ol>
    </section>
  );
}

function NightCell({ n, label }: { n: NightPrice; label: string }) {
  return (
    <li
      data-testid="price-preview-night"
      data-night={n.night}
      data-kind={n.kind ?? "none"}
      data-price={n.price ?? ""}
      aria-label={label}
      title={label}
      className={`flex min-w-0 flex-col items-center rounded-[0.7rem] border px-0.5 py-1.5 text-center ${
        n.kind ? KIND_CELL[n.kind] : "border-dashed border-danger/40 text-danger"
      }`}
    >
      <span aria-hidden className="text-[11px] leading-none">
        {fmt.weekday(n.night)}
      </span>
      <span aria-hidden className="mt-0.5 text-[13px] leading-tight font-semibold">
        {fmt.day(n.night)}
      </span>
      <span aria-hidden className="mt-1 w-full truncate text-[11px] leading-none sm:text-[12px] font-semibold tabular-nums">
        {n.price === null ? "—" : amount.format(n.price / 100)}
      </span>
    </li>
  );
}
