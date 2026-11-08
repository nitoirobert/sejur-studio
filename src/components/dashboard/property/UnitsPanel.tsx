"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { BedDouble, Check, GripVertical, Pencil, Plus, Trash2, Users } from "lucide-react";
import { deleteUnit, reorderUnits, saveUnit } from "@/app/dashboard/proprietati/actions";
import { Sheet } from "@/components/dashboard/booking/Sheet";
import { baniToInput, lei, useSave } from "./client";
import type { UnitRow } from "./data";
import { AMENITIES, LIMITS, UNIT_TYPES, type ActionResult, type Amenity, type UnitType } from "./schema";
import {
  AmenityPicker,
  Field,
  FormMessage,
  SelectBox,
  SubmitButton,
  actionBar,
  danger,
  described,
  ghost,
  input,
  panel,
  primary,
  sectionHeading,
  select,
  textarea,
} from "./ui";

/** Units in a list ordered by hand. A drag shows at once; the saves run one after another. */
export function UnitsPanel({ propertyId, units }: { propertyId: string; units: UnitRow[] }) {
  const t = useTranslations("Dashboard.properties");
  const [localIds, setLocalIds] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<UnitRow | "new" | null>(null);
  const [formKey, setFormKey] = useState(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(0);

  // The local order wins while saves run; units added or removed meanwhile still show.
  const byId = new Map(units.map((u) => [u.id, u]));
  const ordered = localIds
    ? [...localIds.flatMap((id) => byId.get(id) ?? []), ...units.filter((u) => !localIds.includes(u.id))]
    : units;
  // Drop the local order only once the server props show the same order: clearing it on the save's
  // reply would flash the old order until the refreshed props arrive (and a quick second drag would grab the wrong row).
  if (localIds && ordered.length === units.length && ordered.every((r, i) => r.id === units[i].id)) setLocalIds(null);

  // A stable id: dnd-kit counts instances otherwise, and server and browser count differently.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = ordered.map((u) => u.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setLocalIds(next);
    setNotice(null);
    inFlight.current += 1;
    // Each save sends the whole order; chained, so two quick drags land in the order they were made.
    queue.current = queue.current.then(async () => {
      let r: ActionResult;
      try {
        r = await reorderUnits({ property_id: propertyId, ids: next });
      } catch {
        r = { ok: false, code: "generic" };
      }
      inFlight.current -= 1;
      if (!r.ok) {
        setLocalIds(null); // back to the server order
        setNotice({ tone: "error", text: t(`formErrors.${r.code}`) });
      } else if (inFlight.current === 0) {
        setNotice({ tone: "ok", text: t("units.reordered") });
      }
    });
  };

  const open = (u: UnitRow | "new") => {
    setFormKey((k) => k + 1);
    setNotice(null);
    setEditing(u);
  };

  return (
    <section data-testid="unit-panel" className={`${panel} p-4 sm:p-7`} aria-labelledby="units-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
        <div>
          <h3 id="units-title" className={sectionHeading}>
            {t("units.title")}
          </h3>
          <p data-testid="unit-count" className="mt-1 text-sm text-ink-soft">
            {t("units.count", { count: units.length })}
            {units.length > 1 && <span className="hidden sm:inline"> · {t("units.dragHint")}</span>}
          </p>
        </div>
        <button type="button" data-testid="unit-add" onClick={() => open("new")} className={`${primary} px-5`}>
          <Plus className="size-4" aria-hidden />
          {t("units.add")}
        </button>
      </div>

      <div aria-live="polite">
        {notice && (
          <div className="mb-4">
            <FormMessage testId={notice.tone === "error" ? "unit-error" : "unit-notice"} tone={notice.tone}>
              {notice.text}
            </FormMessage>
          </div>
        )}
      </div>

      {ordered.length === 0 ? (
        <p data-testid="unit-empty" className="rounded-inner border border-dashed border-glass-line px-5 py-10 text-center text-[15px] text-ink-soft">
          {t("units.empty")}
        </p>
      ) : (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ordered.map((u) => u.id)} strategy={verticalListSortingStrategy}>
            <ul data-testid="unit-list" className="flex flex-col gap-2">
              {ordered.map((u) => (
                <UnitItem
                  key={u.id}
                  unit={u}
                  onEdit={() => open(u)}
                  onDeleted={(r) => setNotice(r.ok ? { tone: "ok", text: t("units.deleted") } : { tone: "error", text: t(`formErrors.${r.code}`) })}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? t("units.form.titleNew") : t("units.form.titleEdit")}
        closeLabel={t("units.form.close")}
        testId="unit-sheet"
      >
        {editing !== null && (
          <UnitForm
            key={formKey}
            propertyId={propertyId}
            unit={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              setNotice({ tone: "ok", text: t("units.saved") });
            }}
          />
        )}
      </Sheet>
    </section>
  );
}

function UnitItem({ unit, onEdit, onDeleted }: { unit: UnitRow; onEdit: () => void; onDeleted: (r: ActionResult) => void }) {
  const t = useTranslations("Dashboard.properties");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: unit.id });
  const [confirming, setConfirming] = useState(false);
  const { pending, run, formError } = useSave();

  return (
    <li
      ref={setNodeRef}
      data-testid="unit-row"
      data-unit-id={unit.id}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }}
      className={`flex flex-col gap-3 rounded-inner border border-glass-line bg-cream-50/70 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4 ${
        isDragging ? "relative z-10 shadow-glass ring-2 ring-accent/40" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          type="button"
          ref={setActivatorNodeRef}
          data-testid="unit-handle"
          aria-label={t("units.dragHandle", { name: unit.name })}
          title={t("units.dragHint")}
          className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-full text-ink-soft hover:bg-cream-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span data-testid="unit-name" className="min-w-0 truncate text-[16px] font-semibold text-ink">
              {unit.name}
            </span>
            <span
              data-testid="unit-published"
              data-published={unit.isPublished}
              className={`inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold ${
                unit.isPublished ? "bg-accent-50 text-accent dark:bg-accent/15" : "border border-glass-line text-ink-soft"
              }`}
            >
              {unit.isPublished && <Check className="size-3" aria-hidden />}
              {unit.isPublished ? t("units.published") : t("units.draft")}
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-soft">
            <span>{t(`unitTypes.${unit.type}`)}</span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden />
              {t("units.guests", { count: unit.maxGuests })}
            </span>
            <span className="inline-flex items-center gap-1">
              <BedDouble className="size-3.5" aria-hidden />
              {unit.beds}
            </span>
            <span data-testid="unit-price" className="font-semibold text-ink tabular-nums">
              {unit.basePrice === null ? t("units.noPrice") : t("units.perNight", { price: lei(unit.basePrice) })}
            </span>
          </p>
        </div>
      </div>

      {confirming ? (
        <div role="group" aria-label={t("units.deleteConfirm", { name: unit.name })} className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="w-full text-[13px] text-ink sm:w-auto sm:max-w-56">{t("units.deleteConfirm", { name: unit.name })}</span>
          <button
            type="button"
            data-testid="unit-delete-confirm"
            disabled={pending}
            onClick={() =>
              run(
                () => deleteUnit({ id: unit.id }),
                () => onDeleted({ ok: true }),
              )
            }
            className={danger}
          >
            {t("units.deleteYes")}
          </button>
          <button type="button" data-testid="unit-delete-cancel" disabled={pending} onClick={() => setConfirming(false)} className={ghost}>
            {t("units.deleteNo")}
          </button>
          {formError && (
            <p role="alert" data-testid="unit-delete-error" className="w-full text-[13px] font-medium text-danger">
              {formError}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1 self-end sm:self-auto">
          <button type="button" data-testid="unit-edit" onClick={onEdit} aria-label={t("units.edit", { name: unit.name })} title={t("units.edit", { name: unit.name })} className={`${ghost} size-11 px-0`}>
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            data-testid="unit-delete"
            onClick={() => setConfirming(true)}
            aria-label={t("units.delete", { name: unit.name })}
            title={t("units.delete", { name: unit.name })}
            className={`${ghost} size-11 px-0 hover:text-danger`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </li>
  );
}

type UnitValues = {
  name: string;
  type: UnitType;
  max_guests: string;
  bedrooms: string;
  beds: string;
  bathrooms: string;
  area_m2: string;
  description: string;
  amenities: Amenity[];
  is_published: boolean;
  base_price: string;
};

const unitValues = (u: UnitRow | null): UnitValues => ({
  name: u?.name ?? "",
  type: u?.type ?? "camera",
  max_guests: String(u?.maxGuests ?? 2),
  bedrooms: String(u?.bedrooms ?? 1),
  beds: String(u?.beds ?? 1),
  bathrooms: String(u?.bathrooms ?? 1),
  area_m2: u?.areaM2 ? String(u.areaM2) : "",
  description: u?.description ?? "",
  amenities: u?.amenities ?? [],
  is_published: u?.isPublished ?? false,
  base_price: baniToInput(u?.basePrice),
});

function UnitForm({
  propertyId,
  unit,
  onCancel,
  onSaved,
}: {
  propertyId: string;
  unit: UnitRow | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Dashboard.properties");
  const id = useId();
  const f = (name: string) => `${id}-${name}`;
  const { pending, run, fieldError, formError } = useSave();
  const [v, setV] = useState<UnitValues>(() => unitValues(unit));
  const set = <K extends keyof UnitValues>(key: K, value: UnitValues[K]) => setV((s) => ({ ...s, [key]: value }));

  const numberField = (key: "max_guests" | "bedrooms" | "beds" | "bathrooms" | "area_m2", label: string, optional = false) => (
    <Field id={f(key)} label={label} optional={optional ? t("units.form.optional") : undefined} error={fieldError(key)}>
      <input
        id={f(key)}
        data-testid={`unit-form-${key.replace("_", "-")}`}
        className={`${input} tabular-nums`}
        inputMode="numeric"
        maxLength={5}
        value={v[key]}
        onChange={(e) => set(key, e.target.value.replace(/\D/g, ""))}
        {...described(f(key), fieldError(key))}
      />
    </Field>
  );

  return (
    <form
      data-testid="unit-form"
      noValidate
      className="flex flex-col gap-5 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => saveUnit({ id: unit?.id ?? null, property_id: propertyId, ...v }),
          () => onSaved(),
        );
      }}
    >
      <Field id={f("name")} label={t("units.form.name")} error={fieldError("name")}>
        <input
          id={f("name")}
          data-testid="unit-form-name"
          data-autofocus
          className={input}
          value={v.name}
          maxLength={LIMITS.unitName}
          placeholder={t("units.form.namePlaceholder")}
          autoComplete="off"
          onChange={(e) => set("name", e.target.value)}
          {...described(f("name"), fieldError("name"))}
        />
      </Field>
      <Field id={f("type")} label={t("units.form.type")} error={fieldError("type")}>
        <SelectBox>
          <select id={f("type")} data-testid="unit-form-type" className={select} value={v.type} onChange={(e) => set("type", e.target.value as UnitType)}>
            {UNIT_TYPES.map((k) => (
              <option key={k} value={k}>
                {t(`unitTypes.${k}`)}
              </option>
            ))}
          </select>
        </SelectBox>
      </Field>
      <Field id={f("price")} label={t("units.form.basePrice")} hint={t("units.form.basePriceHint")} error={fieldError("base_price")}>
        <div className="relative">
          <input
            id={f("price")}
            data-testid="unit-form-price"
            className={`${input} pr-14 tabular-nums`}
            inputMode="decimal"
            maxLength={16}
            placeholder="350"
            value={v.base_price}
            onChange={(e) => set("base_price", e.target.value)}
            {...described(f("price"), fieldError("base_price"), true)}
          />
          <span aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-ink-soft">
            lei
          </span>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {numberField("max_guests", t("units.form.maxGuests"))}
        {numberField("bedrooms", t("units.form.bedrooms"))}
        {numberField("beds", t("units.form.beds"))}
        {numberField("bathrooms", t("units.form.bathrooms"))}
        {numberField("area_m2", t("units.form.area"), true)}
      </div>
      <Field id={f("description")} label={t("units.form.description")} optional={t("units.form.optional")} error={fieldError("description")}>
        <textarea
          id={f("description")}
          data-testid="unit-form-description"
          className={textarea}
          maxLength={LIMITS.unitDescription}
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
          {...described(f("description"), fieldError("description"))}
        />
      </Field>
      <AmenityPicker
        idPrefix="unit-form"
        legend={t("units.form.amenities")}
        options={AMENITIES.map((key) => ({ key, label: t(`amenities.${key}`) }))}
        value={v.amenities}
        onChange={(next) => set("amenities", next as Amenity[])}
        error={fieldError("amenities")}
      />
      <label className="flex cursor-pointer items-start gap-3 rounded-inner border border-glass-line bg-cream-50/60 p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
        <input
          type="checkbox"
          data-testid="unit-form-published"
          className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
          checked={v.is_published}
          onChange={(e) => set("is_published", e.target.checked)}
        />
        <span>
          <span className="block text-[15px] font-semibold text-ink">{t("units.form.published")}</span>
          <span className="mt-0.5 block text-[13px] text-ink-soft">{t("units.form.publishedHint")}</span>
        </span>
      </label>
      {formError && (
        <FormMessage testId="unit-form-error" tone="error">
          {formError}
        </FormMessage>
      )}
      <div className={actionBar}>
        <button type="button" onClick={onCancel} disabled={pending} className={ghost}>
          {t("units.form.cancel")}
        </button>
        <SubmitButton pending={pending} label={t("units.form.submit")} pendingLabel={t("units.form.pending")} testId="unit-submit" className="px-6" />
      </div>
    </form>
  );
}
