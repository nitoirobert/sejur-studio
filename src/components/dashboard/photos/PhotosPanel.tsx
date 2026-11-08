"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { GripVertical, ImagePlus, LoaderCircle, Pencil, Star, Trash2, Upload, X } from "lucide-react";
import {
  deletePhoto,
  discardPhotoUploads,
  preparePhotoUploads,
  registerPhotos,
  reorderPhotos,
  setCoverPhoto,
  updatePhoto,
} from "@/app/dashboard/proprietati/actions";
import { useSave } from "@/components/dashboard/property/client";
import type { PhotoRow } from "@/components/dashboard/property/data";
import { LIMITS, type ActionResult } from "@/components/dashboard/property/schema";
import { FormMessage, SelectBox, danger, ghost, input, panel, primary, sectionHeading, select } from "@/components/dashboard/property/ui";
import { ACCEPT_ATTR, checkImageFile, type FileProblem } from "@/lib/images/check";
import { resizeToWebp } from "@/lib/images/resize";
import { createClient } from "@/lib/supabase/client";

const MAX_BATCH = 20;
const BUCKET = "photos";

type UnitOption = { id: string; name: string };
type Staged = { key: string; file: File; preview: string; alt: string; unitId: string | null };
type Notice = { tone: "ok" | "error"; text: string };
type Progress = { phase: "resizing" | "uploading"; done: number; total: number };

/*
  Poze: choose or drop files -> each is checked (size, type, first bytes) before anything is decoded
  -> alt text and unit per photo -> upload: resized to WebP in the browser, sent straight to Storage
  through signed upload URLs, then registered as rows. The grid below is ordered by hand; one cover.
*/
export function PhotosPanel({ propertyId, photos, units }: { propertyId: string; photos: PhotoRow[]; units: UnitOption[] }) {
  const t = useTranslations("Dashboard.properties.photos");
  const tAll = useTranslations("Dashboard.properties");
  const [staged, setStaged] = useState<Staged[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [missingAlt, setMissingAlt] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localIds, setLocalIds] = useState<string[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(0);
  // Bumped when a save fails: orders queued before that were built on the failed move and are dropped.
  const epoch = useRef(0);
  const previews = useRef(new Set<string>());

  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const byId = new Map(photos.map((p) => [p.id, p]));
  const ordered = localIds ? [...localIds.flatMap((id) => byId.get(id) ?? []), ...photos.filter((p) => !localIds.includes(p.id))] : photos;
  // Drop the local order only once the server props show the same order: clearing it on the save's
  // reply would flash the old order until the refreshed props arrive (and a quick second drag would grab the wrong row).
  if (localIds && ordered.length === photos.length && ordered.every((r, i) => r.id === photos[i].id)) setLocalIds(null);
  const unitName = new Map(units.map((u) => [u.id, u.name]));
  const busy = progress !== null;

  const errorText = (r: ActionResult) => (r.ok ? "" : tAll(`formErrors.${r.code}`));

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    const problems: string[] = [];
    const next: Staged[] = [];
    const room = MAX_BATCH - staged.length;
    if (files.length > room) problems.push(t("fileErrors.too_many"));
    for (const file of files.slice(0, Math.max(0, room))) {
      let problem: FileProblem | null;
      try {
        problem = await checkImageFile(file);
      } catch {
        problem = "bad_type";
      }
      if (problem) {
        problems.push(t(`fileErrors.${problem}`, { name: file.name }));
        continue;
      }
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      next.push({ key: crypto.randomUUID(), file, preview, alt: "", unitId: null });
    }
    setFileErrors(problems);
    setNotice(null);
    if (next.length > 0) setStaged((s) => [...s, ...next]);
  }

  const drop = (key: string) =>
    setStaged((s) => {
      const gone = s.find((x) => x.key === key);
      if (gone) {
        URL.revokeObjectURL(gone.preview);
        previews.current.delete(gone.preview);
      }
      return s.filter((x) => x.key !== key);
    });

  const clearStaged = () => {
    staged.forEach((s) => {
      URL.revokeObjectURL(s.preview);
      previews.current.delete(s.preview);
    });
    setStaged([]);
    setMissingAlt(false);
  };

  async function upload() {
    if (staged.some((s) => s.alt.trim() === "")) {
      setMissingAlt(true);
      return;
    }
    setMissingAlt(false);
    setNotice(null);
    const batch = staged;
    const total = batch.length;
    const uploaded: string[] = [];
    const fail = async (text: string, failed?: string) => {
      if (uploaded.length > 0) await discardPhotoUploads({ property_id: propertyId, paths: uploaded }).catch(() => undefined);
      setProgress(null);
      setNotice({ tone: "error", text: failed ? t("fileErrors.resize", { name: failed }) : text });
    };

    try {
      // 1. Resize every photo first: a file the browser cannot decode stops the batch before any upload.
      setProgress({ phase: "resizing", done: 0, total });
      const blobs: Blob[] = [];
      for (const [i, s] of batch.entries()) {
        try {
          blobs.push((await resizeToWebp(s.file)).blob);
        } catch {
          return fail("", s.file.name);
        }
        setProgress({ phase: "resizing", done: i + 1, total });
      }

      // 2. Signed upload URLs: the server picks every path (<org>/<property>/<uuid>.webp).
      const prepared = await preparePhotoUploads({ property_id: propertyId, count: total });
      if (!prepared.ok) return fail(errorText(prepared));

      // 3. Straight to Storage (no 1 MB server-action body limit), then 4. the rows.
      const supabase = createClient();
      setProgress({ phase: "uploading", done: 0, total });
      for (const [i, slot] of prepared.uploads.entries()) {
        const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(slot.path, slot.token, blobs[i], {
          contentType: "image/webp",
          // 5 min, not the default hour: a photo fetched while public may stay cached that long after hiding.
          cacheControl: "300",
        });
        if (error) return fail(tAll("formErrors.upload_failed"));
        uploaded.push(slot.path);
        setProgress({ phase: "uploading", done: i + 1, total });
      }
      const registered = await registerPhotos({
        property_id: propertyId,
        photos: batch.map((s, i) => ({ path: prepared.uploads[i].path, alt: s.alt.trim(), unit_id: s.unitId })),
      });
      // registerPhotos removes the files itself when the rows cannot be written.
      if (!registered.ok) {
        setProgress(null);
        setNotice({ tone: "error", text: errorText(registered) });
        return;
      }
      setProgress(null);
      clearStaged();
      setNotice({ tone: "ok", text: t("uploaded", { count: total }) });
    } catch {
      await fail(tAll("formErrors.generic"));
    }
  }

  // A stable id: dnd-kit counts instances otherwise, and server and browser count differently.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = ordered.map((p) => p.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setLocalIds(next);
    setNotice(null);
    inFlight.current += 1;
    const queuedAt = epoch.current;
    queue.current = queue.current.then(async () => {
      if (queuedAt !== epoch.current) {
        inFlight.current -= 1;
        return;
      }
      let r: ActionResult;
      try {
        r = await reorderPhotos({ property_id: propertyId, ids: next });
      } catch {
        r = { ok: false, code: "generic" };
      }
      inFlight.current -= 1;
      if (!r.ok) {
        epoch.current += 1;
        setLocalIds(null);
        setNotice({ tone: "error", text: errorText(r) });
      } else if (inFlight.current === 0) {
        setNotice({ tone: "ok", text: t("reordered") });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <section className={`${panel} p-4 sm:p-7`} aria-labelledby="photos-upload-title" data-testid="photo-upload">
        <h3 id="photos-upload-title" className="sr-only">
          {t("choose")}
        </h3>
        <div
          data-testid="photo-dropzone"
          data-active={dragOver || undefined}
          onDragOver={(e) => {
            if (busy) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!busy && e.dataTransfer.files.length > 0) void addFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center gap-3 rounded-inner border-2 border-dashed px-5 py-8 text-center transition-colors sm:py-10 ${
            dragOver ? "border-accent bg-accent-50 dark:bg-accent/10" : "border-glass-line bg-cream-50/40"
          }`}
        >
          <span className="grid size-14 place-items-center rounded-[1.1rem] bg-cream-50/90 text-accent shadow-pill">
            <ImagePlus className="size-6" aria-hidden />
          </span>
          <button type="button" data-testid="photo-choose" disabled={busy} onClick={() => fileInput.current?.click()} className={`${primary} px-5`}>
            {t("choose")}
          </button>
          <p className="max-w-[52ch] text-[13px] leading-relaxed text-ink-soft">{dragOver ? t("dropActive") : t("dropHint")}</p>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            data-testid="photo-input"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {fileErrors.length > 0 && (
          <ul role="alert" data-testid="photo-file-errors" className="mt-4 flex flex-col gap-1 rounded-inner bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            {fileErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}

        {staged.length > 0 && (
          <div className="mt-5" data-testid="photo-staged">
            <p className="mb-3 text-sm font-semibold text-ink">
              {t("staged")} · {t("count", { count: staged.length })}
            </p>
            <ul className="flex flex-col gap-3">
              {staged.map((s) => (
                <StagedItem
                  key={s.key}
                  item={s}
                  units={units}
                  disabled={busy}
                  invalid={missingAlt && s.alt.trim() === ""}
                  onChange={(patch) => setStaged((list) => list.map((x) => (x.key === s.key ? { ...x, ...patch } : x)))}
                  onRemove={() => drop(s.key)}
                />
              ))}
            </ul>
            {missingAlt && (
              <p role="alert" data-testid="photo-alt-missing" className="mt-3 text-[13px] font-medium text-danger">
                {tAll("fieldErrors.alt")}
              </p>
            )}
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" data-testid="photo-clear" disabled={busy} onClick={clearStaged} className={ghost}>
                {t("clear")}
              </button>
              <button type="button" data-testid="photo-upload-submit" disabled={busy} onClick={() => void upload()} className={`${primary} px-6`}>
                {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
                {progress ? t(progress.phase, { done: progress.done, total: progress.total }) : t("upload", { count: staged.length })}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className={`${panel} p-4 sm:p-7`} aria-labelledby="photos-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2 sm:mb-5">
          <h3 id="photos-title" className={sectionHeading}>
            {t("title")}
          </h3>
          <p data-testid="photo-count" className="text-sm text-ink-soft">
            {t("count", { count: photos.length })}
          </p>
        </div>
        <div aria-live="polite">
          {notice && (
            <div className="mb-4">
              <FormMessage testId={notice.tone === "error" ? "photo-error" : "photo-notice"} tone={notice.tone}>
                {notice.text}
              </FormMessage>
            </div>
          )}
        </div>
        {ordered.length === 0 ? (
          <p data-testid="photo-empty" className="rounded-inner border border-dashed border-glass-line px-5 py-10 text-center text-[15px] text-ink-soft">
            {t("empty")}
          </p>
        ) : (
          <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ordered.map((p) => p.id)} strategy={rectSortingStrategy}>
              <ul data-testid="photo-grid" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {ordered.map((p, i) => (
                  <PhotoCard
                    key={p.id}
                    photo={p}
                    index={i}
                    units={units}
                    unitName={p.unitId ? (unitName.get(p.unitId) ?? null) : null}
                    onResult={(r, ok) => setNotice(r.ok ? { tone: "ok", text: t(ok) } : { tone: "error", text: errorText(r) })}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>
    </div>
  );
}

function UnitSelect({
  id,
  value,
  units,
  disabled,
  testId,
  onChange,
}: {
  id: string;
  value: string | null;
  units: UnitOption[];
  disabled?: boolean;
  testId: string;
  onChange: (v: string | null) => void;
}) {
  const t = useTranslations("Dashboard.properties.photos");
  return (
    <SelectBox>
      <select id={id} data-testid={testId} disabled={disabled} className={select} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{t("unitNone")}</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </SelectBox>
  );
}

function StagedItem({
  item,
  units,
  disabled,
  invalid,
  onChange,
  onRemove,
}: {
  item: Staged;
  units: UnitOption[];
  disabled: boolean;
  invalid: boolean;
  onChange: (patch: Partial<Staged>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("Dashboard.properties.photos");
  const id = useId();
  return (
    <li data-testid="photo-staged-item" className="flex gap-3 rounded-inner border border-glass-line bg-cream-50/70 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview, nothing to optimize */}
      <img src={item.preview} alt="" className="size-20 shrink-0 rounded-[0.9rem] object-cover sm:size-24" />
      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <label htmlFor={`${id}-alt`} className="mb-1 block truncate text-[13px] font-semibold text-ink">
            {t("alt")} <span className="font-normal text-ink-soft">· {item.file.name}</span>
          </label>
          <input
            id={`${id}-alt`}
            data-testid="photo-staged-alt"
            className={`${input} h-11`}
            value={item.alt}
            maxLength={LIMITS.alt}
            disabled={disabled}
            placeholder={t("altPlaceholder")}
            aria-invalid={invalid || undefined}
            aria-describedby={`${id}-hint`}
            onChange={(e) => onChange({ alt: e.target.value })}
          />
          <p id={`${id}-hint`} className="sr-only">
            {t("altHint")}
          </p>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-unit`} className="mb-1 block text-[13px] font-semibold text-ink">
            {t("unit")}
          </label>
          <UnitSelect id={`${id}-unit`} testId="photo-staged-unit" value={item.unitId} units={units} disabled={disabled} onChange={(unitId) => onChange({ unitId })} />
        </div>
      </div>
      <button
        type="button"
        data-testid="photo-staged-remove"
        disabled={disabled}
        onClick={onRemove}
        aria-label={t("remove", { name: item.file.name })}
        title={t("remove", { name: item.file.name })}
        className={`${ghost} size-11 shrink-0 self-start px-0`}
      >
        <X className="size-4" aria-hidden />
      </button>
    </li>
  );
}

type OkKey = "saved" | "deleted" | "coverSet";

function PhotoCard({
  photo,
  index,
  units,
  unitName,
  onResult,
}: {
  photo: PhotoRow;
  index: number;
  units: UnitOption[];
  unitName: string | null;
  onResult: (r: ActionResult, ok: OkKey) => void;
}) {
  const t = useTranslations("Dashboard.properties.photos");
  const id = useId();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [alt, setAlt] = useState(photo.alt);
  const [unitId, setUnitId] = useState(photo.unitId);
  const { pending, run, formError, fieldError } = useSave();

  const act = (action: () => Promise<ActionResult>, ok: OkKey, after?: () => void) =>
    run(action, () => {
      after?.();
      onResult({ ok: true }, ok);
    });

  return (
    <li
      ref={setNodeRef}
      data-testid="photo-card"
      data-photo-id={photo.id}
      data-cover={photo.isCover}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }}
      className={`flex flex-col overflow-hidden rounded-inner border bg-cream-50/70 ${
        photo.isCover ? "border-accent/60" : "border-glass-line"
      } ${isDragging ? "relative z-10 shadow-glass ring-2 ring-accent/40" : ""}`}
    >
      <div className="relative aspect-[4/3] bg-cream-100">
        {photo.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket
          <img src={photo.url} alt={photo.alt} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-ink-soft">
            <ImagePlus className="size-6" aria-hidden />
          </div>
        )}
        <button
          type="button"
          ref={setActivatorNodeRef}
          data-testid="photo-handle"
          aria-label={t("dragHandle", { n: index + 1 })}
          title={t("dragHandle", { n: index + 1 })}
          className="absolute top-2 left-2 grid size-11 cursor-grab touch-none place-items-center rounded-full bg-cream-50/90 text-ink shadow-pill backdrop-blur focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-5" aria-hidden />
        </button>
        {photo.isCover && (
          <span
            data-testid="photo-cover-badge"
            className="absolute top-3 right-3 inline-flex h-7 items-center gap-1 rounded-full bg-accent px-3 text-xs font-semibold text-cream-50 shadow-pill dark:bg-accent-strong dark:text-[#0d1626]"
          >
            <Star className="size-3.5 fill-current" aria-hidden />
            {t("cover")}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {mode === "edit" ? (
          <form
            noValidate
            data-testid="photo-edit-form"
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => updatePhoto({ id: photo.id, alt, unit_id: unitId }), "saved", () => setMode("view"));
            }}
          >
            <label htmlFor={`${id}-alt`} className="text-[13px] font-semibold text-ink">
              {t("alt")}
            </label>
            <input
              id={`${id}-alt`}
              data-testid="photo-edit-alt"
              data-autofocus
              className={`${input} h-11`}
              value={alt}
              maxLength={LIMITS.alt}
              aria-invalid={fieldError("alt") ? true : undefined}
              onChange={(e) => setAlt(e.target.value)}
            />
            <label htmlFor={`${id}-unit`} className="text-[13px] font-semibold text-ink">
              {t("unit")}
            </label>
            <UnitSelect id={`${id}-unit`} testId="photo-edit-unit" value={unitId} units={units} onChange={setUnitId} />
            {(fieldError("alt") || formError) && (
              <p role="alert" data-testid="photo-edit-error" className="text-[13px] font-medium text-danger">
                {fieldError("alt") ?? formError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setAlt(photo.alt);
                  setUnitId(photo.unitId);
                  setMode("view");
                }}
                className={ghost}
              >
                {t("cancel")}
              </button>
              <button type="submit" data-testid="photo-edit-save" disabled={pending} className={`${primary} px-5`}>
                {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                {t("save")}
              </button>
            </div>
          </form>
        ) : (
          <>
            <p data-testid="photo-alt" className="line-clamp-2 text-[14px] leading-snug text-ink">
              {photo.alt}
            </p>
            <p data-testid="photo-unit" className="text-[12px] text-ink-soft">
              {unitName ?? t("unitNone")}
            </p>
            {mode === "delete" ? (
              <div role="group" aria-label={t("deleteConfirm")} className="mt-auto flex flex-col gap-2 pt-1">
                <p className="text-[13px] text-ink">{t("deleteConfirm")}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" data-testid="photo-delete-confirm" disabled={pending} onClick={() => act(() => deletePhoto({ id: photo.id }), "deleted")} className={danger}>
                    {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                    {t("deleteYes")}
                  </button>
                  <button type="button" data-testid="photo-delete-cancel" disabled={pending} onClick={() => setMode("view")} className={ghost}>
                    {t("deleteNo")}
                  </button>
                </div>
                {formError && (
                  <p role="alert" className="text-[13px] font-medium text-danger">
                    {formError}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-auto flex items-center gap-1 pt-1">
                {!photo.isCover && (
                  <button
                    type="button"
                    data-testid="photo-make-cover"
                    disabled={pending}
                    onClick={() => act(() => setCoverPhoto({ id: photo.id }), "coverSet")}
                    className={`${ghost} min-h-10 px-3 text-[13px]`}
                  >
                    <Star className="size-3.5" aria-hidden />
                    {t("makeCover")}
                  </button>
                )}
                <span className="ml-auto" />
                <button
                  type="button"
                  data-testid="photo-edit"
                  onClick={() => setMode("edit")}
                  aria-label={t("edit")}
                  title={t("edit")}
                  className={`${ghost} size-11 px-0`}
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  data-testid="photo-delete"
                  onClick={() => setMode("delete")}
                  aria-label={t("delete")}
                  title={t("delete")}
                  className={`${ghost} size-11 px-0 hover:text-danger`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            )}
            {mode === "view" && formError && (
              <p role="alert" className="text-[13px] font-medium text-danger">
                {formError}
              </p>
            )}
          </>
        )}
      </div>
    </li>
  );
}
