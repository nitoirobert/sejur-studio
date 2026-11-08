import { ChevronDown, LoaderCircle } from "lucide-react";
import { primaryButton } from "@/components/ui/soft";

/* Shared pieces of the properties area: the same glass panel, inputs and buttons as brief 03. */

export const panel = "rounded-card border border-glass-line bg-glass shadow-glass backdrop-blur-xl backdrop-saturate-150";

export const input =
  "h-12 w-full rounded-inner border border-glass-line bg-cream-100/85 px-4 text-base text-ink shadow-pressed outline-none transition-[box-shadow,border-color] duration-150 placeholder:text-ink-soft/80 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/20 disabled:opacity-60";

export const textarea = `${input} h-auto min-h-28 resize-y py-3 leading-relaxed`;

export const select = `${input} appearance-none pr-11`;

/** A native select with the chevron drawn on top (appearance-none drops the system one). */
export function SelectBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-soft" />
    </div>
  );
}

export const primary = `${primaryButton} min-h-12 disabled:opacity-80 dark:bg-accent-strong dark:font-bold dark:text-[#0d1626] dark:hover:bg-accent`;

export const ghost =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-[15px] font-medium text-ink-soft transition-colors hover:bg-cream-50/70 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50";

export const danger =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-danger/10 px-4 text-[15px] font-semibold text-danger transition-colors hover:bg-danger/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-50";

export const sectionHeading = "font-serif text-xl leading-tight text-ink md:text-2xl";

export function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  optional?: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-soft">({optional})</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} data-testid={`field-error-${id.split("-").pop()}`} className="mt-1.5 text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-[13px] leading-snug text-ink-soft">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** aria props for an input inside <Field>: invalid + described by its error or hint. */
export function described(id: string, error: string | null | undefined, hasHint = false) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
  } as const;
}

export function FormMessage({ testId, tone, children }: { testId: string; tone: "error" | "ok"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      data-testid={testId}
      className={`rounded-inner px-4 py-3 text-sm font-medium ${tone === "error" ? "bg-danger/10 text-danger" : "bg-accent-50 text-accent dark:bg-accent/15"}`}
    >
      {children}
    </p>
  );
}

export function SubmitButton({
  pending,
  label,
  pendingLabel,
  testId,
  className = "",
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
  testId: string;
  className?: string;
}) {
  return (
    <button type="submit" data-testid={testId} disabled={pending} className={`${primary} ${className}`}>
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {pending ? pendingLabel : label}
    </button>
  );
}

/** Phone: actions pinned to the bottom of a sheet while the fields scroll; wider: inline. */
export const actionBar =
  "sticky bottom-0 z-10 -mx-5 flex flex-col-reverse gap-2 border-t border-glass-line bg-glass-strong px-5 pt-3 pb-1 backdrop-blur-xl sm:flex-row sm:justify-end md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pt-1 md:backdrop-blur-none";

/** Checkbox chips for the fixed amenity list. */
export function AmenityPicker({
  idPrefix,
  legend,
  options,
  value,
  onChange,
  error,
}: {
  idPrefix: string;
  legend: string;
  options: readonly { key: string; label: string }[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  error?: string | null;
}) {
  return (
    <fieldset data-testid={`${idPrefix}-amenities`}>
      <legend className="mb-2 text-sm font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.key);
          return (
            <label
              key={o.key}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-[14px] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                on ? "border-accent bg-accent text-cream-50 dark:bg-accent-strong dark:text-[#0d1626]" : "border-glass-line bg-cream-50/60 text-ink hover:bg-cream-50"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                data-testid={`${idPrefix}-amenity-${o.key}`}
                checked={on}
                onChange={() => onChange(on ? value.filter((k) => k !== o.key) : [...value, o.key])}
              />
              {o.label}
            </label>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-[13px] font-medium text-danger">{error}</p>}
    </fieldset>
  );
}
